import React, { useState, useMemo, useEffect } from "react";
import useFeedbackRatings from "../hooks/useFeedbackRatings";
import FeedbackModal from "../components/FeedbackModal";
import FilterBar from "../components/FilterBars";
import FeedbackTable from "../components/FeedbackTable";



const Feedback = ({ user }) => {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [office, setOffice] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  
  // Use the custom hook to fetch feedbacks
  const { feedbacks, loading, error } = useFeedbackRatings();

  // ✅ FIX: Set office to user's office if they're an Office Admin
  useEffect(() => {
    if ((user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin") && user?.office) {
      setOffice(user.office);
    }
  }, [user]);
 
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
        .filter((f) => {
          if (!f) return false;
          
          // IMPORTANT: Only show feedback that has a comment/suggestion
          const hasSuggestion = f.suggestion && 
                                typeof f.suggestion === 'string' && 
                                f.suggestion.trim() !== "";
          
          if (!hasSuggestion) return false;
          
          const feedbackOffice = f.office || "Unspecified";
          const searchLower = (search || "").toLowerCase();
          
          // Safe search across multiple fields
          const nameMatch = (f.name || "").toLowerCase().includes(searchLower);
          const suggestionMatch = (f.suggestion || "").toLowerCase().includes(searchLower);
          const visitIdMatch = (f.visitId || "").toLowerCase().includes(searchLower);
          const matchesSearch = nameMatch || suggestionMatch || visitIdMatch;
          
          // Handle date filter safely
          const dateString = getSafeDateString(f.createdAt);
          const matchesDate = !date || dateString === date;
          
          // Handle office filter based on user role
          let matchesOffice = true;
          if (user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin") {
            matchesOffice = feedbackOffice === (user.office || "");
          } else if (office) {
            matchesOffice = feedbackOffice === office;
          }
          
          return matchesSearch && matchesDate && matchesOffice;
        })
        .map((f, idx) => {
          const feedbackOffice = f.office || "Unspecified";
          const formattedDate = getDisplayDate(f.createdAt);
          
          return {
            // Data for FeedbackTable
            id: f.id || `feedback-${idx}`,
            alias: `Anonymous${String(idx + 1).padStart(3, "0")}`,
            office: feedbackOffice,
            comment: f.suggestion || "No feedback given.",
            date: formattedDate,
            satisfaction: parseFloat(f.averageRating) || 0,
            
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
  }, [feedbacks, search, date, office, user]);

  // Calculate statistics for display
  const stats = useMemo(() => {
    try {
      if (filteredFeedbacks.length === 0) {
        return { averageRating: "0.0", total: 0 };
      }
      
      const totalRating = filteredFeedbacks.reduce((sum, f) => {
        const rating = parseFloat(f.satisfaction) || 0;
        return sum + rating;
      }, 0);
      
      return {
        averageRating: (totalRating / filteredFeedbacks.length).toFixed(1),
        total: filteredFeedbacks.length,
      };
    } catch (err) {
      console.error("Error calculating stats:", err);
      return { averageRating: "0.0", total: 0 };
    }
  }, [filteredFeedbacks]);

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
      const headers = ["Alias", "Name", "Date", "Office", "Rating", "Feedback"];
      const csvRows = filteredFeedbacks.map(f => [
        f.alias,
        f.name,
        f.date,
        f.office || "Unspecified",
        f.satisfaction,
        `"${(f.comment || "").replace(/"/g, '""')}"`
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
      if (filteredFeedbacks.length === 0) {
        alert("No data to export!");
        return;
      }
      alert(`Export PDF would generate a PDF with ${filteredFeedbacks.length} records.`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      alert("Failed to export PDF. Please try again.");
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
        satisfaction: visitor.satisfaction || 0,
        answers: visitor.answers || [],
        visitId: visitor.visitId || "",
      };
      setSelectedVisitor(modalData);
    } catch (err) {
      console.error("Error opening modal:", err);
      alert("Failed to open feedback details. Please try again.");
    }
  };

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
    <div className="min-h-screen dark:bg-[#1f1f1f]">
      <div className="px-4 sm:px-8 pt-6 pb-6 space-y-6 flex flex-col">
       
        {/* 🔍 Filters */}
        <FilterBar
          search={search}
          setSearch={setSearch}
          date={date}
          setDate={setDate}
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
  );
};

export default Feedback;