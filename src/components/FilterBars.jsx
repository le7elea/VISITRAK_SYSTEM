import React from "react";
import { Search } from "lucide-react";

const FilterBar = ({
  search,
  setSearch,
  date,
  setDate,
  office,
  setOffice,
  officeOptions = [],
  user, // ✅ Accept user prop
}) => {
  // Automatically hide if user is OfficeAdmin
  const hideOfficeFilter = user?.type === "OfficeAdmin";

  return (
    <div className="border border-[#7400EA] rounded-xl bg-white shadow-sm dark:bg-gray-900 dark:text-gray-200">
      <div className="border-b border-indigo-100 px-4 sm:px-6 py-3">
        <h3 className="font-semibold text-gray-800 text-sm sm:text-base dark:text-gray-100">
          Search & Filters
        </h3>
      </div>

      <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* 🔍 Search Input */}
        <div className="relative flex-1">
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
        </div>

        {/* 🏢 Office Filter (hidden if Office Admin) */}
        {!hideOfficeFilter && (
          <div className="relative w-full lg:w-52">
            <select
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white appearance-none dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="">All Offices</option>
              {officeOptions.map((o, i) => (
                <option key={i} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 📅 Date Picker */}
        <div className="relative w-full lg:w-52">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 dark:text-gray-200"
          />
        </div>

        
      </div>
    </div>
  );
};

export default FilterBar;
