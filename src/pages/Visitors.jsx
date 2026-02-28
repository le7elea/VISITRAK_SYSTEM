import React, { useState, useMemo, useEffect } from "react";
import FilterBar from "../components/FilterBar";
import VisitorTable from "../components/VisitorTable";
import VisitorInfoModal from "../components/VisitorInfoModal";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import bisuLogo from "../assets/bisulogo.png";
import bagongPilipinasLogo from "../assets/bagong_pilipinas_logo.png";
import tuvISOLogo from "../assets/tuvISO_logo.png";

const getNumericRating = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeQuestionRatings = (answers) => {
  if (!answers) return [];

  if (Array.isArray(answers)) {
    return answers.map((answer, index) => {
      if (answer && typeof answer === "object") {
        return {
          question:
            answer.question ||
            answer.label ||
            answer.text ||
            answer.title ||
            answer.prompt ||
            answer.item ||
            `Question ${index + 1}`,
          rating: getNumericRating(
            answer.rating ??
              answer.score ??
              answer.value ??
              answer.answer ??
              answer.selected
          ),
        };
      }

      return {
        question: `Question ${index + 1}`,
        rating: getNumericRating(answer),
      };
    });
  }

  if (typeof answers === "object") {
    return Object.entries(answers).map(([question, rating], index) => ({
      question: question || `Question ${index + 1}`,
      rating: getNumericRating(rating),
    }));
  }

  return [];
};

const parseDateValue = (dateValue) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRangeDate = (dateValue) => {
  const parsed = parseDateValue(dateValue);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatMonthDay = (dateValue) => {
  const parsed = parseDateValue(dateValue);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const formatYear = (dateValue) => {
  const parsed = parseDateValue(dateValue);
  if (!parsed) return "";
  return parsed.getFullYear();
};

const getVisitorSortTime = (visitor) => {
  const sourceDate = visitor?.rawDate || visitor?.checkInTime || null;
  const parsed =
    sourceDate instanceof Date ? sourceDate : new Date(sourceDate || 0);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

const Visitors = ({ user = { type: "SuperAdmin", office: null } }) => {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [visits, setVisits] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState([]); 
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // Fetch visits from Firestore
  useEffect(() => {
    const q = query(collection(db, "visits"), orderBy("checkInTime", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          const checkInTime = d.checkInTime?.toDate() || new Date();
          const checkOutTime = d.checkOutTime?.toDate() || null;

          return {
            id: doc.id,
            visitorId: d.visitorId,
            name: d.visitorName || d.name || "Unknown Visitor",
            email: d.email || "",
            phone: d.phone || "",
            contactNumber: d.contactNumber || d.phone || d.email || "",
            office: d.office || "Unknown Office",
            purpose: d.purpose || "",
            checkInTime: checkInTime,
            checkOutTime: checkOutTime,
            status: d.status || (checkOutTime ? "checked-out" : "checked-in"),
            // Format for display
            date: checkInTime.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            timeIn: checkInTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            timeOut: checkOutTime
              ? checkOutTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "-",
            // For filtering by exact date
            rawDate: checkInTime,
          };
        });

        setVisits(data);
      },
      (error) => {
        console.error("Error fetching visits:", error);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  // Fetch feedbacks from Firestore
  useEffect(() => {
    const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          const rawAnswers = d.answers ?? d.questionRatings ?? d.ratings ?? [];
          return {
            id: doc.id,
            visitId: d.visitId,
            averageRating: d.averageRating || 0,
            createdAt: d.createdAt?.toDate() || new Date(),
            questionRatings: normalizeQuestionRatings(rawAnswers),
          };
        });

        setFeedbacks(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching feedbacks:", error);
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  // Fetch offices from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "offices"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name || "",
            officialName: d.officialName || "",
            role: d.role || "",
            email: d.email || "",
          };
        });

        setOffices(data);
      },
      (error) => {
        console.error("Error fetching offices:", error);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  // Combine visits with feedback ratings
  const visitsWithRatings = useMemo(() => {
    return visits.map(visit => {
      const feedback = feedbacks.find(f => f.visitId === visit.id);
      
      return {
        ...visit,
        satisfaction: feedback?.averageRating || 0,
        questionRatings: feedback?.questionRatings || [],
      };
    });
  }, [visits, feedbacks]);
  // Export to PDF function
  const exportPDF = () => {
    try {
      window.print();
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
  };

  const handleViewVisitorDetails = (visitor) => {
    setSelectedVisitor(visitor || null);
  };

  // Render stars for satisfaction ratings
  const renderStars = (rating) => {
    const normalizedRating = Math.min(5, Math.max(0, Math.round(rating || 0)));
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < normalizedRating ? "text-yellow-400" : "text-gray-300"}>
            ★
          </span>
        ))}
      </div>
    );
  };

  // Get unique offices from visits for the filter dropdown
  const uniqueOffices = useMemo(() => {
    const offices = visitsWithRatings
      .map(v => v.office)
      .filter((office, index, self) => 
        office && office.trim() !== "" && self.indexOf(office) === index
      )
      .sort();
    
    return ["All Offices", ...offices];
  }, [visitsWithRatings]);

  // Filter visits based on user office (if OfficeAdmin)
  const officeFiltered = useMemo(() => {
    if (user.type === "OfficeAdmin" && user.office) {
      return visitsWithRatings.filter((v) => v.office === user.office);
    }
    return visitsWithRatings;
  }, [visitsWithRatings, user]);

  // Apply search, office dropdown (if SuperAdmin), and date range filters
  const filteredVisitors = useMemo(() => {
    return officeFiltered.filter((v) => {
      const matchSearch = 
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.email && v.email.toLowerCase().includes(search.toLowerCase())) ||
        (v.phone && v.phone.includes(search));
      
      const matchOffice =
        user.type === "SuperAdmin"
          ? officeFilter === "All Offices" || v.office === officeFilter
          : true;
      
      const visitorDate = v.rawDate ? new Date(v.rawDate) : new Date();
      let matchesStart = true;
      let matchesEnd = true;

      if (startDateFilter) {
        const startDate = new Date(startDateFilter);
        startDate.setHours(0, 0, 0, 0);
        matchesStart = visitorDate >= startDate;
      }

      if (endDateFilter) {
        const endDate = new Date(endDateFilter);
        endDate.setHours(23, 59, 59, 999);
        matchesEnd = visitorDate <= endDate;
      }

      return matchSearch && matchOffice && matchesStart && matchesEnd;
    });
  }, [officeFiltered, search, officeFilter, startDateFilter, endDateFilter, user.type]);

  // Print view should list oldest records first.
  const printVisitors = useMemo(() => {
    return [...filteredVisitors].sort((a, b) => {
      const timeDiff = getVisitorSortTime(a) - getVisitorSortTime(b);
      if (timeDiff !== 0) return timeDiff;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }, [filteredVisitors]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredVisitors.length;
    const checkedIn = filteredVisitors.filter(v => v.status === 'checked-in').length;
    const checkedOut = filteredVisitors.filter(v => v.status === 'checked-out').length;
    
    const ratedVisitors = filteredVisitors.filter(v => v.satisfaction > 0);
    const avgSatisfaction = ratedVisitors.length > 0 
      ? (ratedVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / ratedVisitors.length).toFixed(1)
      : "0.0";
    
    return { total, checkedIn, checkedOut, avgSatisfaction };
  }, [filteredVisitors]);

  const currentOfficeRecord = useMemo(() => {
    if (!user || offices.length === 0) return null;

    if (user.id) {
      const byId = offices.find(o => o.id === user.id);
      if (byId) return byId;
    }

    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    if (userEmail) {
      const byEmail = offices.find(o => (o.email || "").toLowerCase().trim() === userEmail);
      if (byEmail) return byEmail;
    }

    if (user.office) {
      const byOfficeName = offices.find(o => o.name === user.office);
      if (byOfficeName) return byOfficeName;
    }

    if (user.type === "SuperAdmin") {
      return offices.find(o => o.role === "super") || null;
    }

    return null;
  }, [user, offices]);

  // Get the official office name for print header
  const printOfficeName = useMemo(() => {
    const fallbackOfficeName = "Office of the College of Computing and Information Sciences";

    if (user.type === "OfficeAdmin" && user.office) {
      const office = offices.find(o => o.name === user.office);
      return office?.officialName || user.office;
    }

    if (user.type === "SuperAdmin" && officeFilter === "All Offices") {
      return (
        currentOfficeRecord?.officialName ||
        currentOfficeRecord?.name ||
        user.office ||
        fallbackOfficeName
      );
    }

    if (officeFilter !== "All Offices") {
      const office = offices.find(o => o.name === officeFilter);
      return office?.officialName || officeFilter;
    }

    return fallbackOfficeName;
  }, [user, officeFilter, offices, currentOfficeRecord]);

  const selectedDateRangeLabel = useMemo(() => {
    const startLabel = formatRangeDate(startDateFilter);
    const endLabel = formatRangeDate(endDateFilter);
    const startYear = formatYear(startDateFilter);
    const endYear = formatYear(endDateFilter);

    if (startLabel && endLabel) {
      if (startYear && endYear && startYear === endYear) {
        return `${formatMonthDay(startDateFilter)} - ${formatMonthDay(endDateFilter)}, ${endYear}`;
      }
      return `${startLabel} - ${endLabel}`;
    }
    if (startLabel) return `From ${startLabel}`;
    if (endLabel) return `Up to ${endLabel}`;
    return "All Dates";
  }, [startDateFilter, endDateFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7400EA] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading visitor records...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen View - Original Design */}
      <div className="print:hidden px-6 md:px-10 pt-2 pb-6 space-y-4 font-sans">
        <FilterBar
          user={user}
          search={search}
          setSearch={setSearch}
          officeFilter={officeFilter}
          setOfficeFilter={setOfficeFilter}
          startDateFilter={startDateFilter}
          setStartDateFilter={setStartDateFilter}
          endDateFilter={endDateFilter}
          setEndDateFilter={setEndDateFilter}
          exportPDF={exportPDF}
          uniqueOffices={uniqueOffices}
        />

        <VisitorTable
          visitors={filteredVisitors}
          renderStars={renderStars}
          onViewDetails={handleViewVisitorDetails}
        />
      </div>

      <VisitorInfoModal
        isOpen={!!selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        visitorData={selectedVisitor}
        ratingsOnly
      />

      {/* Print View Only - BISU Format */}
      <div className="hidden print:block bg-white print-only-section">
        {/* Split visitors into pages of 17 rows each */}
        {(() => {
          const rowsPerPage = 17;
          const totalPages = Math.ceil(printVisitors.length / rowsPerPage) || 1;
          
          return Array.from({ length: totalPages }).map((_, pageIndex) => {
            const startIndex = pageIndex * rowsPerPage;
            const pageVisitors = printVisitors.slice(startIndex, startIndex + rowsPerPage);
            const emptyRowsNeeded = rowsPerPage - pageVisitors.length;
            
            return (
              <div key={pageIndex} className="page-break p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-28 h-20 flex items-center justify-center">
                      <img 
                        src={bisuLogo} 
                        alt="BISU Logo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-[14px]">Republic of the Philippines</p>
                      <h1 className="text-lg font-bold">BOHOL ISLAND STATE UNIVERSITY</h1>
                      <p className="text-[14px]">Magsija, Balilihan 6342, Bohol, Philippines</p>
                      <p className="text-[14px]">{printOfficeName}</p>
                      <p className="text-[14px] italic">Balance | Integrity | Stewardship | Uprightness</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-22 h-26 flex items-center justify-center">
                      <img 
                        src={bagongPilipinasLogo} 
                        alt="Bagong Pilipinas Logo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="w-42 h-26 flex items-center justify-center">
                      <img 
                        src={tuvISOLogo} 
                        alt="ISO 9001:2015 Certification" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-center text-base font-bold mb-3 uppercase">Visitors' Log Sheet</h2>
                {/* <p className="text-center text-[11px] mb-3">Date Range: {selectedDateRangeLabel}</p> */}

                {/* Table */}
                <table className="w-full border-collapse border-1 border-black">
                  <thead>
                    <tr className="bg-white">
                      <th className="border-2 border-black p-1 text-[11px] font-bold text-center w-[15%]">
                        Date<br/>(MM-DD-YY)
                      </th>
                      <th className="border-2 border-black p-1 text-[11px] font-bold text-center w-[12%]">
                        Time In
                      </th>
                      <th className="border-2 border-black p-1 text-[11px] font-bold text-center w-[23%]">
                        Name
                      </th>
                      <th className="border-2 border-black p-1 text-[11px] font-bold text-center w-[25%]">
                        Purpose
                      </th>
                      <th className="border-2 border-black p-1 text-[11px] font-bold text-center w-[25%]">
                        Contact Number /<br/>email address
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageVisitors.map((visitor) => {
                      const dateObj = visitor.rawDate || new Date();
                      const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')} – ${String(dateObj.getDate()).padStart(2, '0')} - ${String(dateObj.getFullYear()).slice(-2)}`;
                      
                      return (
                        <tr key={visitor.id}>
                          <td className="border-2 border-black p-1 text-[10px] text-center">
                            {formattedDate}
                          </td>
                          <td className="border-2 border-black p-1 text-[10px] text-center">
                            {visitor.timeIn}
                          </td>
                          <td className="border-2 border-black p-1 text-[10px] text-center">
                            {visitor.name}
                          </td>
                          <td className="border-2 border-black p-1 text-[10px] text-center">
                            {visitor.purpose}
                          </td>
                          <td className="border-2 border-black p-1 text-[10px] text-center">
                            {visitor.contactNumber}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Add empty rows to complete 17 rows per page */}
                    {Array.from({ length: emptyRowsNeeded }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td className="border-2 border-black p-1 text-[10px] text-center">&nbsp;</td>
                        <td className="border-2 border-black p-1 text-[10px] text-center">&nbsp;</td>
                        <td className="border-2 border-black p-1 text-[10px] text-center">&nbsp;</td>
                        <td className="border-2 border-black p-1 text-[10px] text-center">&nbsp;</td>
                        <td className="border-2 border-black p-1 text-[10px] text-center">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          });
        })()}
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          /* Hide everything except the print view */
          body * {
            visibility: hidden;
          }
          
          /* Only show the print section and its children */
          .print-only-section,
          .print-only-section * {
            visibility: visible;
          }
          
          /* Position print section at top of page */
          .print-only-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          @page {
            size: 13in 8.5in;
            margin: 0.5in;
          }
          
          /* Hide browser default headers and footers */
          @page {
            margin: 0.5in;
          }
          
          html {
            margin: 0;
          }
          
          body {
            margin: 0;
          }
          
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          .page-break:last-child {
            page-break-after: auto;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
};

export default Visitors;

