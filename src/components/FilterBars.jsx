import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Download } from "lucide-react";

const FilterBar = ({
  search,
  setSearch,
  dayRange,
  setDayRange,
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
  const safeDayRange = dayRange || { start: "", end: "" };
  const [showDayRangeDropdown, setShowDayRangeDropdown] = useState(false);
  const [pendingDayRange, setPendingDayRange] = useState(safeDayRange);
  const dayRangeDropdownRef = useRef(null);

  useEffect(() => {
    setPendingDayRange(safeDayRange);
  }, [safeDayRange.start, safeDayRange.end]);

  useEffect(() => {
    if (!showDayRangeDropdown) return undefined;

    const handleOutsideClick = (event) => {
      if (
        dayRangeDropdownRef.current &&
        !dayRangeDropdownRef.current.contains(event.target)
      ) {
        setShowDayRangeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showDayRangeDropdown]);

  const formatDateDisplay = (value) => {
    if (!value) return "";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const dayRangeLabel = useMemo(() => {
    if (safeDayRange.start && safeDayRange.end) {
      return `${formatDateDisplay(safeDayRange.start)} - ${formatDateDisplay(
        safeDayRange.end
      )}`;
    }

    if (safeDayRange.start) return `From ${formatDateDisplay(safeDayRange.start)}`;
    if (safeDayRange.end) return `Until ${formatDateDisplay(safeDayRange.end)}`;
    return "Select date range";
  }, [safeDayRange.start, safeDayRange.end]);

  const handleDayRangeChange = (field, value) => {
    setPendingDayRange((prev) => {
      const next = {
        ...(prev || { start: "", end: "" }),
        [field]: value,
      };

      if (next.start && next.end && next.start > next.end) {
        if (field === "start") {
          next.end = value;
        } else {
          next.start = value;
        }
      }

      return next;
    });
  };

  const applyDayRangeSelection = () => {
    if (typeof setDayRange !== "function") return;

    setDayRange({
      start: pendingDayRange?.start || "",
      end: pendingDayRange?.end || "",
    });
    setShowDayRangeDropdown(false);
  };

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
      <div className="p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
          {/* Office Filter (DISABLED for Office Admin) */}
          <div className="w-full md:flex-1 md:min-w-[260px]">
            <select
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              disabled={isOfficeAdmin}
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
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
          </div>

          <div className="relative w-full md:w-[280px] lg:w-[300px] md:shrink-0" ref={dayRangeDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setPendingDayRange({
                start: safeDayRange.start || "",
                end: safeDayRange.end || "",
              });
              setShowDayRangeDropdown((prev) => !prev);
            }}
            className="h-[46px] w-full border-2 border-gray-800 rounded-xl px-4 bg-white text-gray-800 flex items-center justify-between"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium min-w-0">
              <Calendar size={16} className="text-gray-600 shrink-0" />
              <span className="truncate">{dayRangeLabel}</span>
            </span>
            <ChevronDown
              size={16}
              className={`text-gray-600 transition-transform ${
                showDayRangeDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showDayRangeDropdown && (
            <div className="absolute left-0 top-full mt-2 w-full bg-gray-100 border border-gray-300 rounded-xl shadow-lg p-3 z-50">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={pendingDayRange.start || ""}
                    max={pendingDayRange.end || undefined}
                    onChange={(e) => handleDayRangeChange("start", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={pendingDayRange.end || ""}
                    min={pendingDayRange.start || undefined}
                    onChange={(e) => handleDayRangeChange("end", e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={applyDayRangeSelection}
                  className="w-full bg-[#6B46C1] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#5B34B8] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default FilterBar;
