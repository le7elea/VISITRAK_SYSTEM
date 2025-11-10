import React, { useState, useMemo } from "react";
import FeedbackModal from "../components/FeedbackModal";
import FilterBar from "../components/FilterBars";

const Feedback = ({ visitors = [], user }) => {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [office, setOffice] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // 🧠 Generate unique office options
  const officeOptions = useMemo(() => {
    const offices = [...new Set(visitors.map((v) => v.office).filter(Boolean))];
    return offices.sort();
  }, [visitors]);

  // 🔎 Combined filter logic
  const filteredVisitors = visitors.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase());
    const matchesDate = !date || v.date === date.split("-").reverse().join("/");
    const matchesOffice =
      !office || v.office === office || user?.role === "Office Admin";
    return matchesSearch && matchesDate && matchesOffice;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between dark:bg-[#1f1f1f]">
      <div className="px-4 sm:px-8 pt-8 space-y-6">
        {/* 🔍 Search & Filters */}
        <FilterBar
          search={search}
          setSearch={setSearch}
          date={date}
          setDate={setDate}
          office={office}
          setOffice={setOffice}
          officeOptions={officeOptions}
          user = { user }

        />

        {/* 📋 Feedback Records Section */}
        <div className="border border-[#7400EA] rounded-xl bg-white shadow-sm p-4 sm:p-6 dark:bg-gray-900 dark:text-gray-200">
          {filteredVisitors.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {filteredVisitors.map((v) => (
                <li key={v.id} className="py-3 sm:py-4 rounded-lg px-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">
                        {v.name}{" "}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({v.office})
                        </span>
                      </h4>

                      <div className="mt-1 flex items-center">
                        <p className="text-sm text-gray-600 truncate max-w-xs dark:text-gray-300">
                          {v.comment || "No feedback given."}
                        </p>

                        {v.comment && v.comment.length > 50 && (
                          <button
                            onClick={() => setSelectedVisitor(v)}
                            className="ml-2 text-indigo-600 text-xs font-medium hover:underline"
                          >
                            View Full
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-1">{v.date}</p>
                    </div>

                    <div className="text-yellow-500 font-semibold">
                      ⭐ {v.satisfaction?.toFixed(1) || "N/A"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-400 text-sm py-6">
              No Feedback Records Found
            </p>
          )}
        </div>
      </div>

      <FeedbackModal
        isOpen={!!selectedVisitor}
        onClose={() => setSelectedVisitor(null)}
        visitor={selectedVisitor}
      />
    </div>
  );
};

export default Feedback;
