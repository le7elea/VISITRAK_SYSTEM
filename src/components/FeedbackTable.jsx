import React from "react";

const FeedbackTable = ({ visitors = [], onViewFull }) => {
  // Max 6 items visible at a time, scrollable if more
  const maxVisibleItems = 6;
  const containerHeight = maxVisibleItems * 76; // Approx. each item height ~76px including padding

  return (
    <div
      className="border border-[#7400EA] rounded-xl bg-white shadow-sm p-4 sm:p-6 dark:bg-gray-900 dark:text-gray-200 overflow-y-auto"
      style={{ maxHeight: `${containerHeight}px` }}
    >
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Visitor Insights
      </h3>

      {visitors.length > 0 ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {visitors.map((v) => (
            <li key={v.id} className="py-3 sm:py-4 rounded-lg px-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-800 dark:text-white">
                    {v.alias}{" "}
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
                        onClick={() => onViewFull(v)}
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
  );
};

export default FeedbackTable;
