import React from "react";
import { Search, Download } from "lucide-react";

const FilterBar = ({
  search,
  setSearch,
  date,
  setDate,
  office,
  setOffice,
  exportCSV,
  exportPDF,
  officeOptions = [],
  user,
  totalCount,
  filteredCount,
}) => {
  // Check both 'type' and 'role' fields to match Login.jsx structure
  const isOfficeAdmin = user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin";
  
  console.log("FilterBar - User type:", user?.type);
  console.log("FilterBar - User role:", user?.role);
  console.log("FilterBar - isOfficeAdmin:", isOfficeAdmin);

  return (
    <div className="border border-[#7400EA] rounded-xl bg-white shadow-sm dark:bg-gray-900 dark:text-gray-200">
      
      {/* Header + Export Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-indigo-100 px-4 sm:px-6 py-3 gap-3">
        <h3 className="font-semibold text-gray-800 text-sm sm:text-base dark:text-gray-100">
          Search & Filters
        </h3>

        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-blue-800 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition"
          >
            <Download size={16} /> Print PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-4 lg:gap-4">
        
        {/* Office Filter (DISABLED for Office Admin) */}
        <select
          value={office}
          onChange={(e) => setOffice(e.target.value)}
          disabled={isOfficeAdmin}
          className={`w-full lg:w-135 px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400
            ${isOfficeAdmin
              ? "bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
              : "bg-white dark:bg-gray-900 dark:text-gray-200"}
          `}
        >
          <option value="">All Offices</option>
          {officeOptions.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>

        {/* Date Filter */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full lg:w-135 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 dark:text-gray-200"
        />
      </div>
    </div>
  );
};

export default FilterBar;