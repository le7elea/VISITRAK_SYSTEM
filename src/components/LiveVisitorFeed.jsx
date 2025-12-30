import React from "react";

const LiveVisitorFeed = ({ visitors = [] }) => {
  const getStatusColor = (status) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("check out") || statusLower.includes("checked out")) {
      return "bg-green-100 text-green-700 border border-green-300";
    }
    return "bg-yellow-100 text-yellow-700 border border-yellow-300";
  };

  return (
    <section className="bg-white p-6 rounded-2xl border border-[#7400EA] shadow-sm mt-8 dark:bg-gray-900 dark:text-gray-200">

      {/* Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
          Live Visitor Feed
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Latest check-ins across offices
        </p>
      </div>

      {/* Scrollable when more than 5 rows */}
      <div className="max-h-[310px] overflow-y-auto overflow-x-hidden pr-2">

        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
            <tr className="border-b border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              <th className="text-left py-3 px-4 font-medium">Name</th>
              <th className="text-left py-3 px-4 font-medium">Office</th>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">Time In</th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            {visitors.length > 0 ? (
              visitors.map((v, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap text-gray-800 dark:text-gray-100">
                    {v.name}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {v.office}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {v.date}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {v.checkInTimeFormatted || "N/A"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold px-3 py-1 rounded-full text-xs sm:text-sm ${getStatusColor(
                        v.status
                      )}`}
                    >
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="text-center py-6 text-gray-500 dark:text-gray-400"
                >
                  No visitors found for this office.
                </td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
    </section>
  );
};

export default LiveVisitorFeed;