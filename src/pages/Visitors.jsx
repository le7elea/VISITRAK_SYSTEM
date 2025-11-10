import React, { useState, useMemo } from "react";
import FilterBar from "../components/FilterBar";
import VisitorTable from "../components/VisitorTable";
import { useVisitorData } from "../data/VisitorData";

const Visitors = ({ user = { type: "SuperAdmin", office: null } }) => {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [dateFilter, setDateFilter] = useState("");

  const { visitors } = useVisitorData();

  const exportCSV = () => alert("Export CSV clicked!");
  const exportPDF = () => alert("Export PDF clicked!");

  const renderStars = (count) => (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < count ? "text-yellow-400" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );

  // ✅ Step 1: Filter visitors based on user office (if OfficeAdmin)
  const officeFiltered = useMemo(() => {
    if (user.type === "OfficeAdmin") {
      return visitors.filter((v) => v.office === user.office);
    }
    return visitors;
  }, [visitors, user]);

  // ✅ Step 2: Apply search, office dropdown (if SuperAdmin), and date filters
  const filteredVisitors = useMemo(() => {
    return officeFiltered.filter((v) => {
      const matchSearch = v.name.toLowerCase().includes(search.toLowerCase());
      const matchOffice =
        user.type === "SuperAdmin"
          ? officeFilter === "All Offices" || v.office === officeFilter
          : true; // OfficeAdmin does not use office filter
      const matchDate =
        !dateFilter || v.date === new Date(dateFilter).toLocaleDateString();

      return matchSearch && matchOffice && matchDate;
    });
  }, [officeFiltered, search, officeFilter, dateFilter, user.type]);

  return (
    <div className="p-6 md:p-10 space-y-6 font-sans">
      {/* 🔍 Filters */}
      <FilterBar
        user={user} // pass user info
        search={search}
        setSearch={setSearch}
        officeFilter={officeFilter}
        setOfficeFilter={setOfficeFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        exportCSV={exportCSV}
        exportPDF={exportPDF}
      />

      {/* 📋 Visitor Table */}
      <VisitorTable visitors={filteredVisitors} renderStars={renderStars} />
    </div>
  );
};

export default Visitors;
