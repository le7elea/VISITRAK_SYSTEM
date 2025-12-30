import React, { useState, useMemo } from "react";
import FeedbackModal from "../components/FeedbackModal";
import FilterBar from "../components/FilterBars";
import FeedbackTable from "../components/FeedbackTable";

const Feedback = ({ visitors = [], user }) => {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [office, setOffice] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  const exportCSV = () => alert("Export CSV clicked!");
  const exportPDF = () => alert("Export PDF clicked!");

  // Generate unique office options
  const officeOptions = useMemo(() => {
    // Filter visitors with comments before getting offices
    const visitorsWithComments = visitors.filter(v => v.feedback?.trim());
    const offices = [...new Set(visitorsWithComments.map((v) => v.office).filter(Boolean))];
    return offices.sort();
  }, [visitors]);

  // Combined filter logic - now also filtering out visitors without comments
  const filteredVisitors = visitors
    .filter((v) => {
      // First, check if visitor has any feedback comments
      const hasComment = v.feedback && v.feedback.trim().length > 0;
      if (!hasComment) return false;
      
      // Then apply other filters
      const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase());
      const matchesDate = !date || v.date === date.split("-").reverse().join("/");
      const matchesOffice =
        user?.role === "Office Admin"
          ? v.office === user.office
          : !office || v.office === office;
      return matchesSearch && matchesDate && matchesOffice;
    })
    .map((v, idx) => ({
      ...v,
      alias: `Anonymous${String(idx + 1).padStart(3, "0")}`,
    }));

  return (
    <div className="min-h-screen dark:bg-[#1f1f1f]">
      <div className="px-4 sm:px-8 pt-6 pb-6 space-y-6 flex flex-col">
        {/* 🔍 Filters */}
        <FilterBar
          date={date}
          setDate={setDate}
          office={office}
          setOffice={setOffice}
          exportCSV={exportCSV}
          exportPDF={exportPDF}
          officeOptions={officeOptions}
          user={user}
        />

        {/* 📋 Feedback Table */}
        <FeedbackTable
          visitors={filteredVisitors}
          onViewFull={(v) => setSelectedVisitor(v)}
        />
      </div>

      {/* Modal Overlay */}
      <FeedbackModal
        isOpen={!!selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        visitor={selectedVisitor}
      />
    </div>
  );
};

export default Feedback;