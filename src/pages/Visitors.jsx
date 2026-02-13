import React, { useState, useMemo, useEffect } from "react";
import FilterBar from "../components/FilterBar";
import VisitorTable from "../components/VisitorTable";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import bisuLogo from "../assets/bisulogo.png";
import bagongPilipinasLogo from "../assets/bagong_pilipinas_logo.png";
import tuvISOLogo from "../assets/tuvISO_logo.png";

const Visitors = ({ user = { type: "SuperAdmin", office: null } }) => {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [dateFilter, setDateFilter] = useState("");
  const [visits, setVisits] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState([]); 

  // Fetch visits from Firestore
  useEffect(() => {
    const fetchVisits = () => {
      try {
        const q = query(collection(db, "visits"), orderBy("checkInTime", "desc"));
        
        const unsub = onSnapshot(q, (snapshot) => {
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
              status: d.status || (checkOutTime ? 'checked-out' : 'checked-in'),
              // Format for display
              date: checkInTime.toLocaleDateString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric' 
              }),
              timeIn: checkInTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              }),
              timeOut: checkOutTime 
                ? checkOutTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                : "-",
              // For filtering by exact date
              rawDate: checkInTime
            };
          });
          
          setVisits(data);
        }, (error) => {
          console.error("Error fetching visits:", error);
        });

        return () => unsub();
      } catch (error) {
        console.error("Error setting up visits listener:", error);
      }
    };

    fetchVisits();
  }, []);

  // Fetch feedbacks from Firestore
  useEffect(() => {
    const fetchFeedbacks = () => {
      try {
        const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
        
        const unsub = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              visitId: d.visitId,
              averageRating: d.averageRating || 0,
              createdAt: d.createdAt?.toDate() || new Date(),
            };
          });
          
          setFeedbacks(data);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching feedbacks:", error);
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error("Error setting up feedbacks listener:", error);
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, []);

  // Fetch offices from Firestore
  useEffect(() => {
    const fetchOffices = () => {
      try {
        const unsub = onSnapshot(collection(db, "offices"), (snapshot) => {
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
        }, (error) => {
          console.error("Error fetching offices:", error);
        });

        return () => unsub();
      } catch (error) {
        console.error("Error setting up offices listener:", error);
      }
    };

    fetchOffices();
  }, []);

  // Combine visits with feedback ratings
  const visitsWithRatings = useMemo(() => {
    return visits.map(visit => {
      const feedback = feedbacks.find(f => f.visitId === visit.id);
      
      return {
        ...visit,
        satisfaction: feedback?.averageRating || 0,
      };
    });
  }, [visits, feedbacks]);

  // Export to Excel function with images
  const exportExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Visitors Log", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    // =========================
    // COLUMN WIDTHS (A–F)
    // =========================
    worksheet.columns = [
      { width: 20 }, // A - Date / Logo
      { width: 14 }, // B - Time In
      { width: 28 }, // C - Name
      { width: 34 }, // D - Purpose
      { width: 24 }, // E - Office
      { width: 32 }, // F - Contact
    ];

    // =========================
    // ROW HEIGHTS
    // =========================
    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 30;
    worksheet.getRow(3).height = 22;
    worksheet.getRow(4).height = 22;
    worksheet.getRow(5).height = 22;
    worksheet.getRow(7).height = 28;
    worksheet.getRow(9).height = 28;

    // =========================
    // MERGED CELLS (HEADER GRID)
    // =========================
    worksheet.mergeCells("A1:A5"); // BISU Logo
    worksheet.mergeCells("B1:D1"); // Republic
    worksheet.mergeCells("B2:D2"); // University
    worksheet.mergeCells("B3:D3"); // Address
    worksheet.mergeCells("B4:D4"); // Office
    worksheet.mergeCells("B5:D5"); // Core values
    worksheet.mergeCells("E1:E5"); // Bagong Pilipinas
    worksheet.mergeCells("F1:F5"); // TUV ISO

    worksheet.mergeCells("A7:F7"); // Title

    // =========================
    // HEADER TEXT
    // =========================
    worksheet.getCell("B1").value = "Republic of the Philippines";
    worksheet.getCell("B1").font = { size: 11 };
    worksheet.getCell("B1").alignment = { vertical: "middle", horizontal: "left" };

    worksheet.getCell("B2").value = "BOHOL ISLAND STATE UNIVERSITY";
    worksheet.getCell("B2").font = { size: 14, bold: true };
    worksheet.getCell("B2").alignment = { vertical: "middle", horizontal: "left" };

    worksheet.getCell("B3").value = "Magsija, Balilihan 6342, Bohol, Philippines";
    worksheet.getCell("B3").font = { size: 11 };
    worksheet.getCell("B3").alignment = { vertical: "middle", horizontal: "left" };

    worksheet.getCell("B4").value = printOfficeName;
    worksheet.getCell("B4").font = { size: 11 };
    worksheet.getCell("B4").alignment = { vertical: "middle", horizontal: "left" };

    worksheet.getCell("B5").value = "Balance | Integrity | Stewardship | Uprightness";
    worksheet.getCell("B5").font = { size: 11, italic: true };
    worksheet.getCell("B5").alignment = { vertical: "middle", horizontal: "left" };

    // =========================
    // TITLE
    // =========================
    worksheet.getCell("A7").value = "VISITORS' LOG SHEET";
    worksheet.getCell("A7").font = { size: 13, bold: true };
    worksheet.getCell("A7").alignment = { horizontal: "center", vertical: "middle" };

    // =========================
    // IMAGE HELPER
    // =========================
    const getBase64FromUrl = async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    // =========================
    // LOAD IMAGES
    // =========================
    const bisuBase64 = await getBase64FromUrl(bisuLogo);
    const bagongBase64 = await getBase64FromUrl(bagongPilipinasLogo);
    const tuvBase64 = await getBase64FromUrl(tuvISOLogo);

    const bisuImageId = workbook.addImage({ base64: bisuBase64, extension: "png" });
    const bagongImageId = workbook.addImage({ base64: bagongBase64, extension: "png" });
    const tuvImageId = workbook.addImage({ base64: tuvBase64, extension: "png" });

    // =========================
    // PLACE IMAGES (MATCH MERGES)
    // =========================
    worksheet.addImage(bisuImageId, {
      tl: { col: 0, row: 0 },
      br: { col: 1, row: 5 },
    });

    worksheet.addImage(bagongImageId, {
      tl: { col: 4, row: 0 },
      br: { col: 5, row: 5 },
    });

    worksheet.addImage(tuvImageId, {
      tl: { col: 5, row: 1 },
      br: { col: 6, row: 5 },
    });

    // =========================
    // TABLE HEADER
    // =========================
    const headerRow = worksheet.getRow(9);
    headerRow.values = [
      "Date (MM - DD - YY)",
      "Time In",
      "Name",
      "Purpose",
      "Office Visited",
      "Contact Number / Email Address",
    ];

    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // =========================
    // DATA ROWS (WITH MM - DD - YY FORMAT)
    // =========================
    filteredVisitors.forEach((v) => {
      const dateObj = v.rawDate instanceof Date ? v.rawDate : new Date(v.rawDate);

      const row = worksheet.addRow([
        dateObj,              // A - Date
        v.timeIn,             // B - Time In
        v.name,               // C - Name
        v.purpose,            // D - Purpose
        v.office,             // E - Office
        v.contactNumber,      // F - Contact
      ]);

      // =========================
      // FORCE Excel to show MM - DD - YY
      // =========================
      row.getCell(1).numFmt = 'mm" - "dd" - "yy';

      row.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // =========================
    // FOOTER
    // =========================
    worksheet.headerFooter.oddFooter = `&LGenerated: ${new Date().toLocaleString()}&RPage &P of &N`;

    // =========================
    // SAVE FILE
    // =========================
    const fileName =
      user.type === "OfficeAdmin"
        ? `${user.office}-visitors-${new Date().toISOString().split("T")[0]}.xlsx`
        : `visitors-log-${new Date().toISOString().split("T")[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, fileName);
  } catch (error) {
    console.error("❌ Excel export failed:", error);
    alert("Failed to export Excel file.");
  }
};



  // Export to PDF function
  const exportPDF = () => {
    try {
      window.print();
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
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

  // Apply search, office dropdown (if SuperAdmin), and date filters
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
      
      let matchDate = true;
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);
        
        const visitorDate = v.rawDate || new Date();
        visitorDate.setHours(0, 0, 0, 0);
        
        matchDate = visitorDate.getTime() === filterDate.getTime();
      }

      return matchSearch && matchOffice && matchDate;
    });
  }, [officeFiltered, search, officeFilter, dateFilter, user.type]);

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
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          exportExcel={exportExcel}
          exportPDF={exportPDF}
          uniqueOffices={uniqueOffices}
        />

        <VisitorTable visitors={filteredVisitors} renderStars={renderStars} />
      </div>

      {/* Print View Only - BISU Format */}
      <div className="hidden print:block bg-white print-only-section">
        {/* Split visitors into pages of 17 rows each */}
        {(() => {
          const rowsPerPage = 17;
          const totalPages = Math.ceil(filteredVisitors.length / rowsPerPage) || 1;
          
          return Array.from({ length: totalPages }).map((_, pageIndex) => {
            const startIndex = pageIndex * rowsPerPage;
            const pageVisitors = filteredVisitors.slice(startIndex, startIndex + rowsPerPage);
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
