import React from "react";
import { Search, Download } from "lucide-react"; // ⬅️ Added Download icon

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
}) => {
  const hideOfficeFilter = user?.type === "OfficeAdmin"; // Adjust as needed based on your backend

  return (
    <div className="border border-[#7400EA] rounded-xl bg-white shadow-sm dark:bg-gray-900 dark:text-gray-200">
      
      {/* Header + Export Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-indigo-100 px-4 sm:px-6 py-3 gap-3">
        <h3 className="font-semibold text-gray-800 text-sm sm:text-base dark:text-gray-100">
          Search & Filters
        </h3>

        <div className="flex gap-2">
          {/* <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-indigo-800 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition"
          >
            <Download size={16} /> Export CSV
          </button> */}

          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-blue-800 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition"
          >
            <Download size={16} /> Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-4 lg:gap-4">
        {/* Search Input */}
        {/* <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search visitor name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-black dark:bg-gray-900 dark:text-gray-200"
          />
        </div> */}

        {/* Office Filter (hidden for OfficeAdmin) */}
        
          <select
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            className="w-full lg:w-135 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 dark:text-gray-200"
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
