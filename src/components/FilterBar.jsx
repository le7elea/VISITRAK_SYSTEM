import React from "react";
import { Download } from "lucide-react"; // uses lucide-react for icons

const FilterBar = ({
  user,
  search,
  setSearch,
  officeFilter, 
  setOfficeFilter,
  dateFilter,
  setDateFilter,
  exportCSV,
  exportPDF,
  uniqueOffices = [] // Add this prop
}) => {
  return (
    <div className="border border-[#7400EA] dark:border-[#7400EA] rounded-xl shadow-sm p-5 mb-6 bg-white dark:bg-gray-900 dark:text-gray-200 ">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Search & Filters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-indigo-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center border-t border-gray-200 dark:border-gray-700 pt-4 ">
        {/* 🔍 Search bar */}
        <div className="relative w-full md:w-1/1">
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search visitor name, email, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
          />
        </div>

        {/* 🏢 Office Filter - only for SuperAdmin */}
        {user.type === "SuperAdmin" && (
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="w-full md:w-1/4 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
          >
            {uniqueOffices.map((office) => (
              <option key={office} value={office}>
                {office}
              </option>
            ))}
          </select>
        )}

        {/* 📅 Date Filter */}
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-full md:w-1/4 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
        />
      </div>
    </div>
  );
};

export default FilterBar;