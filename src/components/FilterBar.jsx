import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";

const formatDisplayDate = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const FilterBar = ({
  user,
  search,
  setSearch,
  officeFilter,
  setOfficeFilter,
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter,
  exportExcel,
  exportPDF,
  uniqueOffices = [],
}) => {
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(startDateFilter || "");
  const [draftEndDate, setDraftEndDate] = useState(endDateFilter || "");
  const dateMenuRef = useRef(null);

  useEffect(() => {
    setDraftStartDate(startDateFilter || "");
    setDraftEndDate(endDateFilter || "");
  }, [startDateFilter, endDateFilter]);

  useEffect(() => {
    const handleOutsideDateMenuClick = (event) => {
      if (!isDateMenuOpen) return;

      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target)) {
        setIsDateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideDateMenuClick);
    document.addEventListener("touchstart", handleOutsideDateMenuClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideDateMenuClick);
      document.removeEventListener("touchstart", handleOutsideDateMenuClick);
    };
  }, [isDateMenuOpen]);

  const dateRangeLabel = useMemo(() => {
    const startLabel = formatDisplayDate(startDateFilter);
    const endLabel = formatDisplayDate(endDateFilter);

    if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
    if (startLabel) return `${startLabel} - End Date`;
    if (endLabel) return `Start Date - ${endLabel}`;

    return "Select date range";
  }, [startDateFilter, endDateFilter]);

  const handleApplyDateRange = () => {
    setStartDateFilter(draftStartDate);
    setEndDateFilter(draftEndDate);
    setIsDateMenuOpen(false);
  };

  return (
    <div className="border border-[#7400EA] dark:border-[#7400EA] rounded-xl shadow-sm p-5 mb-6 bg-white dark:bg-gray-900 dark:text-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Search & Filters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-indigo-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="relative w-full md:w-1/1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search visitor name, email, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
          />
        </div>

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

        <div className="relative w-full md:w-[300px]" ref={dateMenuRef}>
          <button
            type="button"
            onClick={() => setIsDateMenuOpen((open) => !open)}
            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex items-center justify-between"
          >
            <span className="flex items-center gap-2 min-w-0">
              <CalendarDays className="w-4 h-4 text-gray-500 dark:text-gray-300 shrink-0" />
              <span className="text-sm font-medium truncate">{dateRangeLabel}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${isDateMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isDateMenuOpen && (
            <div className="absolute top-[46px] right-0 w-full z-30 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 shadow-lg">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={draftStartDate}
                    max={draftEndDate || undefined}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-300">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={draftEndDate}
                    min={draftStartDate || undefined}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyDateRange}
                  className="w-full rounded-md bg-[#6E47C4] hover:bg-[#5f3cb0] text-white py-2 text-sm font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
