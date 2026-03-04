import React, { useState, useMemo, useEffect } from "react";
import useFeedbackRatings from "../hooks/useFeedbackRatings";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import FeedbackModal from "../components/FeedbackModal";
import FilterBar from "../components/FilterBars";
import FeedbackTable from "../components/FeedbackTable";
import bisuLogo from "../assets/bisulogo.png";
import bagongPilipinasLogo from "../assets/bagong_pilipinas_logo.png";
import tuvISOLogo from "../assets/tuvISO_logo.png";

const toTrimmedText = (value) => (typeof value === "string" ? value.trim() : "");

const getNumericRating = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeQuestionRatings = (answers, questions = []) => {
  if (!answers) return [];

  if (Array.isArray(answers)) {
    return answers.map((answer, index) => {
      const fallbackQuestion = toTrimmedText(questions[index]) || `Question ${index + 1}`;

      if (answer && typeof answer === "object") {
        const question = toTrimmedText(
          answer.question ||
            answer.label ||
            answer.text ||
            answer.title ||
            answer.prompt ||
            answer.item
        );

        const rating = getNumericRating(
          answer.rating ??
            answer.score ??
            answer.value ??
            answer.answer ??
            answer.selected
        );

        return {
          question: question || fallbackQuestion,
          rating,
        };
      }

      return {
        question: fallbackQuestion,
        rating: getNumericRating(answer),
      };
    });
  }

  if (typeof answers === "object") {
    return Object.entries(answers).map(([question, rating], index) => ({
      question: toTrimmedText(question) || `Question ${index + 1}`,
      rating: getNumericRating(rating),
    }));
  }

  return [];
};

const Feedback = ({ user }) => {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [dateMode, setDateMode] = useState("month");
  const [office, setOffice] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [offices, setOffices] = useState([]);
  
  // Use the custom hook to fetch feedbacks
  const { feedbacks, loading, error } = useFeedbackRatings();

  // ✅ FIX: Set office to user's office if they're an Office Admin
  useEffect(() => {
    if ((user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin") && user?.office) {
      setOffice(user.office);
    }
  }, [user]);

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
 
  // Get a safe date string from createdAt
  const getSafeDateString = (createdAt) => {
    if (!createdAt) return "";
    
    try {
      // Handle both Date objects and Firestore Timestamps
      if (createdAt.toDate) {
        return createdAt.toDate().toISOString().split('T')[0];
      } else if (createdAt.toISOString) {
        return createdAt.toISOString().split('T')[0];
      } else if (typeof createdAt === 'string') {
        return new Date(createdAt).toISOString().split('T')[0];
      }
    } catch (err) {
      console.error("Error parsing date:", err);
    }
    
    return "";
  };

  const getSafeMonthString = (createdAt) => {
    const dayString = getSafeDateString(createdAt);
    if (!dayString) return "";
    return dayString.slice(0, 7);
  };

  // Get formatted display date
  const getDisplayDate = (createdAt) => {
    if (!createdAt) return "Date not available";
    
    try {
      let dateObj;
      
      if (createdAt.toDate) {
        dateObj = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        dateObj = createdAt;
      } else if (typeof createdAt === 'string') {
        dateObj = new Date(createdAt);
      } else {
        dateObj = new Date();
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Invalid date";
    }
  };

  // Combined filter logic with safe data access
  const filteredFeedbacks = useMemo(() => {
    if (!Array.isArray(feedbacks)) {
      return [];
    }
    
    try {
      return feedbacks
        .map((f, idx) => {
          const suggestion = toTrimmedText(f?.suggestion);
          const commendation = toTrimmedText(f?.commendation);
          const questionRatings = normalizeQuestionRatings(f?.answers, f?.questions);

          return { f, idx, suggestion, commendation, questionRatings };
        })
        .filter(({ f, suggestion, commendation }) => {
          if (!f) return false;
          
          const hasWrittenFeedback = Boolean(commendation || suggestion);
          if (!hasWrittenFeedback) return false;
          
          const feedbackOffice = f.office || "Unspecified";
          const searchLower = (search || "").toLowerCase();
          
          // Safe search across multiple fields
          const nameMatch = (f.name || "").toLowerCase().includes(searchLower);
          const suggestionMatch = suggestion.toLowerCase().includes(searchLower);
          const commendationMatch = commendation.toLowerCase().includes(searchLower);
          const visitIdMatch = (f.visitId || "").toLowerCase().includes(searchLower);
          const matchesSearch = nameMatch || suggestionMatch || commendationMatch || visitIdMatch;
          
          // Handle date filter safely
          const dayString = getSafeDateString(f.createdAt);
          const monthString = getSafeMonthString(f.createdAt);
          const matchesDate = !date || (
            dateMode === "day" ? dayString === date : monthString === date
          );
          
          // Handle office filter based on user role
          let matchesOffice = true;
          if (user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin") {
            matchesOffice = feedbackOffice === (user.office || "");
          } else if (office) {
            matchesOffice = feedbackOffice === office;
          }
          
          return matchesSearch && matchesDate && matchesOffice;
        })
        .map(({ f, idx, suggestion, commendation, questionRatings }) => {
          const feedbackOffice = f.office || "Unspecified";
          const formattedDate = getDisplayDate(f.createdAt);
          const previewComment = suggestion || commendation || "No written feedback provided.";
          
          return {
            // Data for FeedbackTable
            id: f.id || `feedback-${idx}`,
            alias: `Anonymous${String(idx + 1).padStart(3, "0")}`,
            office: feedbackOffice,
            comment: previewComment,
            date: formattedDate,
            satisfaction: parseFloat(f.averageRating) || 0,
            commendation: commendation || "No commendation provided.",
            suggestion: suggestion || "No suggestion provided.",
            questionRatings,
            
            // Additional data for FeedbackModal
            name: f.name || "Anonymous",
            answers: f.answers || [],
            createdAt: f.createdAt || new Date(),
            visitId: f.visitId || "",
            
            // Store original for reference
            originalData: f,
          };
        });
    } catch (err) {
      console.error("Error filtering feedbacks:", err);
      return [];
    }
  }, [feedbacks, search, date, dateMode, office, user]);

  // Generate unique office options
  const officeOptions = useMemo(() => {
    try {
      // Extract offices from feedbacks if they exist
      const offices = feedbacks
        .map(f => f.office) 
        .filter(office => office && typeof office === 'string' && office.trim() !== '');
      
      // If no offices found, provide defaults
      if (offices.length === 0) {
        return ["Main Office", "Branch Office", "Headquarters"];
      }
      
      // Return unique sorted offices
      return [...new Set(offices)].sort();
    } catch (err) {
      console.error("Error generating office options:", err);
      return ["Main Office", "Branch Office", "Headquarters"];
    }
  }, [feedbacks]);

  const exportCSV = () => {
    try {
      if (filteredFeedbacks.length === 0) {
        alert("No data to export!");
        return;
      }

      // Prepare CSV content
      const headers = ["Alias", "Name", "Date", "Office", "Rating", "Commendation", "Suggestion"];
      const csvRows = filteredFeedbacks.map(f => [
        f.alias,
        f.name,
        f.date,
        f.office || "Unspecified",
        f.satisfaction,
        `"${(f.commendation || "").replace(/"/g, '""')}"`,
        `"${(f.suggestion || "").replace(/"/g, '""')}"`
      ]);
      
      const csvContent = [
        headers.join(","),
        ...csvRows.map(row => row.join(","))
      ].join("\n");
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedbacks_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const exportPDF = () => {
    try {
      window.print();
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
  };

  // Handle view full action
  const handleViewFull = (visitor) => {
    try {
      if (!visitor) return;
      
      const modalData = {
        name: visitor.name || "Anonymous",
        office: visitor.office || "Unspecified",
        date: visitor.date || "Date not available",
        comment: visitor.comment || "No feedback provided.",
        commendation: visitor.commendation || "No commendation provided.",
        suggestion: visitor.suggestion || "No suggestion provided.",
        satisfaction: visitor.satisfaction || 0,
        answers: visitor.answers || [],
        questionRatings: visitor.questionRatings || [],
        visitId: visitor.visitId || "",
      };
      setSelectedVisitor(modalData);
    } catch (err) {
      console.error("Error opening modal:", err);
      alert("Failed to open feedback details. Please try again.");
    }
  };

  // Get the official office name for print header
  const printOfficeName = useMemo(() => {
    if (user?.type === "OfficeAdmin" && user?.office) {
      const officeData = offices.find(o => o.name === user.office);
      return officeData?.officialName || user.office;
    } else if (office && office !== "") {
      const officeData = offices.find(o => o.name === office);
      return officeData?.officialName || office;
    }
    return "Office of the College of Computing and Information Sciences";
  }, [user, office, offices]);

  const printRows = useMemo(() => {
    const rowsByOffice = new Map();

    filteredFeedbacks.forEach((feedback) => {
      const officeName = toTrimmedText(feedback?.office) || "Unspecified";

      if (!rowsByOffice.has(officeName)) {
        rowsByOffice.set(officeName, {
          office: officeName,
          commendations: [],
          suggestions: [],
        });
      }

      const row = rowsByOffice.get(officeName);
      const commendation = toTrimmedText(feedback?.commendation);
      const suggestion = toTrimmedText(feedback?.suggestion);

      if (
        commendation &&
        commendation !== "No commendation provided." &&
        !row.commendations.includes(commendation)
      ) {
        row.commendations.push(commendation);
      }

      if (
        suggestion &&
        suggestion !== "No suggestion provided." &&
        !row.suggestions.includes(suggestion)
      ) {
        row.suggestions.push(suggestion);
      }
    });

    const rows = [...rowsByOffice.values()].sort((a, b) =>
      a.office.localeCompare(b.office)
    );

    return rows;
  }, [filteredFeedbacks]);

  const reportMonthLabel = useMemo(() => {
    let sourceDate = null;

    if (date) {
      const [year, month] = date.split("-").map(Number);
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        sourceDate = new Date(year, month - 1, 1);
      }
    }

    if (!sourceDate && filteredFeedbacks.length > 0) {
      const createdAt = filteredFeedbacks[0]?.createdAt;

      if (createdAt?.toDate) {
        sourceDate = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        sourceDate = createdAt;
      } else if (typeof createdAt === "string") {
        const parsed = new Date(createdAt);
        if (!Number.isNaN(parsed.getTime())) {
          sourceDate = parsed;
        }
      }
    }

    if (!sourceDate) {
      sourceDate = new Date();
    }

    return sourceDate
      .toLocaleDateString("en-US", { month: "long", year: "numeric" })
      .toUpperCase();
  }, [date, filteredFeedbacks]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading feedback data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center text-red-500 bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md mx-auto">
          <p className="text-lg font-semibold">Error Loading Feedback</p>
          <p className="mt-2">{error.message || "Failed to load feedback data"}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle case where feedbacks is not an array
  if (!Array.isArray(feedbacks)) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg max-w-md mx-auto">
          <p className="text-lg font-semibold">Data Format Issue</p>
          <p className="mt-2">Feedback data is not in the expected format.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen View */}
      <div className="print:hidden min-h-screen dark:bg-[#1f1f1f]">
        <div className="px-4 sm:px-8 pt-6 pb-6 space-y-6 flex flex-col">
         
          {/* 🔍 Filters */}
          <FilterBar
            search={search}
            setSearch={setSearch}
            date={date}
            setDate={setDate}
            dateMode={dateMode}
            setDateMode={setDateMode}
            office={office}
            setOffice={setOffice}
            exportCSV={exportCSV}
            exportPDF={exportPDF}
            officeOptions={officeOptions}
            user={user}
            totalCount={feedbacks.length}
            filteredCount={filteredFeedbacks.length}
          />

          {/* 📋 Feedback Table */}
          {filteredFeedbacks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
              {feedbacks.length === 0 
                ? "No feedback data available yet." 
                : "No feedback matches your filters."}
            </div>
          ) : (
            <>
              <FeedbackTable
                visitors={filteredFeedbacks}
                onViewFull={handleViewFull}
              />
            </>
          )}
        </div>

        {/* Modal Overlay */}
        {selectedVisitor && (
          <FeedbackModal
            isOpen={!!selectedVisitor}
            onClose={() => setSelectedVisitor(null)}
            visitor={selectedVisitor}
          />
        )}
      </div>

      {/* Print View Only - CSF Monthly Commendations & Suggestions */}
      <div className="hidden print:block bg-white print-only-section text-black">
        {(() => {
          const rowsPerPage = 6;
          const totalPages = Math.ceil(printRows.length / rowsPerPage) || 1;

          const renderList = (items = []) => {
            if (!Array.isArray(items) || items.length === 0) {
              return <span>N/A</span>;
            }

            return (
              <ul className="list-disc pl-4 space-y-1">
                {items.map((item, index) => (
                  <li key={`${item}-${index}`} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            );
          };

          return Array.from({ length: totalPages }).map((_, pageIndex) => {
            const startIndex = pageIndex * rowsPerPage;
            const pageRows = printRows.slice(startIndex, startIndex + rowsPerPage);
            const isLastPage = pageIndex === totalPages - 1;

            return (
              <div key={pageIndex} className="page-break p-6 csf-page">
                <div className="flex items-start justify-between mb-5 gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center">
                      <img src={bisuLogo} alt="BISU Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-[12px]">Republic of the Philippines</p>
                      <h1 className="text-[22px] font-bold tracking-wide">BOHOL ISLAND STATE UNIVERSITY</h1>
                      <p className="text-[12px]">Magsija, Balilihan 6342, Bohol, Philippines</p>
                      <p className="text-[12px]">{printOfficeName}</p>
                      <p className="text-[12px] italic">Balance | Integrity | Stewardship | Uprightness</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center">
                    <div className="w-24 h-16 flex items-center justify-center">
                      <img
                        src={bagongPilipinasLogo}
                        alt="Bagong Pilipinas Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="w-32 h-16 flex items-center justify-center">
                      <img src={tuvISOLogo} alt="ISO 9001:2015 Certification" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>

                <h2 className="text-center text-[20px] tracking-wide uppercase mb-4">
                  Monthly Customer Satisfaction Summary Form -{' '}
                  <span className="underline">{reportMonthLabel}</span>
                </h2>

                <p className="text-[18px] font-semibold mb-2">
                  CSF Monthly Commendations &amp; Suggestions
                </p>

                <table className="w-full border-collapse csf-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="w-[16%]">Office</th>
                      <th rowSpan={2} className="w-[18%]">Commendation</th>
                      <th rowSpan={2} className="w-[18%]">Detail of Suggestions</th>
                      <th rowSpan={2} className="w-[7%]">Root Cause</th>
                      <th rowSpan={2} className="w-[8%]">Action Plan</th>
                      <th rowSpan={2} className="w-[9%]">Target of Implementation</th>
                      <th colSpan={3} className="w-[24%]">Status of Implementation</th>
                    </tr>
                    <tr>
                      <th className="w-[8%]">Implementation (Closed)</th>
                      <th className="w-[8%]">On-going / To be Implemented (Open)</th>
                      <th className="w-[8%]">Not Implemented</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, rowIndex) => (
                      <tr key={`${row.office}-${pageIndex}-${rowIndex}`}>
                        <td>{row.office}</td>
                        <td>{renderList(row.commendations)}</td>
                        <td>{renderList(row.suggestions)}</td>
                        <td className="text-center">N/A</td>
                        <td className="text-center">N/A</td>
                        <td className="text-center">N/A</td>
                        <td className="text-center">N/A</td>
                        <td className="text-center">N/A</td>
                        <td className="text-center">N/A</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isLastPage && (
                  <div className="mt-10 text-[13px] feedback-signatories">
                    <div className="grid grid-cols-2 gap-24 mb-6 feedback-signatories-row">
                      <div className="text-center feedback-signatory-group">
                        <p className="text-left mb-3">Prepared:</p>
                        <p className="font-semibold underline feedback-signatory-name">MA. MAELITH L. BUCHAN</p>
                        <p>Administrative Aide VI</p>
                      </div>

                      <div className="text-center feedback-signatory-group">
                        <p className="text-left mb-3">Verified:</p>
                        <p className="font-semibold underline feedback-signatory-name">HORONORIO O. UEHARA</p>
                        <p>Human Resource Management Officer II</p>
                      </div>
                    </div>

                    <div className="max-w-md mx-auto text-center feedback-signatories-row">
                      <div className="feedback-signatory-group">
                        <p className="mb-3 text-left pl-10">Approved:</p>
                        <p className="font-semibold underline feedback-signatory-name">MARRIETA C. MACALOLOT, PhD</p>
                        <p>Campus Director</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          });
        })()}
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print-only-section,
          .print-only-section * {
            visibility: visible;
          }
          
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
          
          html {
            margin: 0;
          }
          
          body {
            margin: 0;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .csf-page {
            min-height: 7.2in;
          }

          .csf-table th,
          .csf-table td {
            border: 1px solid #000 !important;
            vertical-align: top;
          }

          .csf-table th {
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            padding: 6px 4px;
          }

          .csf-table td {
            font-size: 10px;
            padding: 6px 6px;
          }

          .csf-table ul {
            margin: 0;
            padding-left: 14px;
          }

          .csf-table li {
            margin-bottom: 3px;
          }
          
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          .page-break:last-child {
            page-break-after: auto;
          }

          .feedback-signatories,
          .feedback-signatories-row,
          .feedback-signatory-group {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .feedback-signatory-name {
            white-space: nowrap;
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

export default Feedback;


