import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";

const getMonthValueFromDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "";

  const [startYear, startMonth, startDay] = startDate.split("-");
  const [endYear, endMonth, endDay] = endDate.split("-");
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return "";
  }

  const lastDayOfMonth = new Date(
    Number(startYear),
    Number(startMonth),
    0,
  ).getDate();

  if (
    startYear === endYear &&
    startMonth === endMonth &&
    startDay === "01" &&
    Number(endDay) === lastDayOfMonth
  ) {
    return `${startYear}-${startMonth}`;
  }

  return "";
};

const getDateRangeFromMonth = (monthValue) => {
  if (!monthValue) return { startDate: "", endDate: "" };

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return { startDate: "", endDate: "" };

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return {
    startDate: `${monthValue}-01`,
    endDate: `${monthValue}-${String(lastDayOfMonth).padStart(2, "0")}`,
  };
};

const formatCompactDateDisplay = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
};

const formatMonthDisplay = (monthValue) => {
  if (!monthValue) return "";

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return monthValue;

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
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
  exportPDF,
  uniqueOffices = [],
}) => {
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [dateRangeMode, setDateRangeMode] = useState(() =>
    getMonthValueFromDateRange(startDateFilter, endDateFilter) ? "month" : "day"
  );
  const [pendingDayRange, setPendingDayRange] = useState({
    start: startDateFilter || "",
    end: endDateFilter || "",
  });
  const [monthRange, setMonthRange] = useState(() =>
    getMonthValueFromDateRange(startDateFilter, endDateFilter)
  );
  const dateMenuRef = useRef(null);

  useEffect(() => {
    const currentMonth = getMonthValueFromDateRange(
      startDateFilter,
      endDateFilter
    );

    setPendingDayRange({
      start: startDateFilter || "",
      end: endDateFilter || "",
    });
    setMonthRange(currentMonth || (startDateFilter || "").slice(0, 7));
    setDateRangeMode(currentMonth ? "month" : "day");
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
    if (dateRangeMode === "month") {
      const monthValue =
        getMonthValueFromDateRange(startDateFilter, endDateFilter) ||
        monthRange;
      return monthValue ? `Month: ${formatMonthDisplay(monthValue)}` : "Select month";
    }

    const startLabel = formatCompactDateDisplay(startDateFilter);
    const endLabel = formatCompactDateDisplay(endDateFilter);

    if (startLabel && endLabel) return `Day: ${startLabel} - ${endLabel}`;
    if (startLabel) return `${startLabel} - End Date`;
    if (endLabel) return `Start Date - ${endLabel}`;

    return "Select date range";
  }, [dateRangeMode, endDateFilter, monthRange, startDateFilter]);

  const handleDateRangeModeChange = (nextMode) => {
    setDateRangeMode(nextMode);

    if (nextMode === "month") {
      const monthValue =
        getMonthValueFromDateRange(startDateFilter, endDateFilter) ||
        (startDateFilter || "").slice(0, 7) ||
        monthRange;
      setMonthRange(monthValue);
      return;
    }

    setPendingDayRange({
      start: startDateFilter || "",
      end: endDateFilter || "",
    });
  };

  const handleMonthRangeChange = (value) => {
    if (!value) return;
    setMonthRange(value);
  };

  const handleDayRangeChange = (field, value) => {
    if (!value) return;
    setPendingDayRange((previous) => {
      const next = {
        ...previous,
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
    if (!pendingDayRange.start || !pendingDayRange.end) return;
    setStartDateFilter(pendingDayRange.start);
    setEndDateFilter(pendingDayRange.end);
    setIsDateMenuOpen(false);
  };

  const applyMonthRangeSelection = () => {
    if (!monthRange) return;
    const { startDate, endDate } = getDateRangeFromMonth(monthRange);
    if (!startDate || !endDate) return;
    setStartDateFilter(startDate);
    setEndDateFilter(endDate);
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
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#7400EA] hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Print Report
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
                    Range Type
                  </label>
                  <select
                    value={dateRangeMode}
                    onChange={(e) => handleDateRangeModeChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                  >
                    <option value="month">Month</option>
                    <option value="day">Day</option>
                  </select>
                </div>

                {dateRangeMode === "month" ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-300">
                        Month
                      </label>
                      <input
                        type="month"
                        value={monthRange}
                        onChange={(e) => handleMonthRangeChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={applyMonthRangeSelection}
                      className="w-full rounded-md bg-[#6E47C4] hover:bg-[#5f3cb0] text-white py-2 text-sm font-medium"
                    >
                      Apply
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-300">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={pendingDayRange.start}
                        max={pendingDayRange.end || undefined}
                        onChange={(e) =>
                          handleDayRangeChange("start", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-300">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={pendingDayRange.end}
                        min={pendingDayRange.start || undefined}
                        onChange={(e) =>
                          handleDayRangeChange("end", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={applyDayRangeSelection}
                      className="w-full rounded-md bg-[#6E47C4] hover:bg-[#5f3cb0] text-white py-2 text-sm font-medium"
                    >
                      Apply
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
