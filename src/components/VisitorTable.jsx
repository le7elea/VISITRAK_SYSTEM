import React from "react";

const VisitorTable = ({ visitors = [], renderStars }) => {
  // Format status for display
  const formatStatus = (status) => {
    if (status === 'checked-out') return 'Check Out';
    if (status === 'checked-in') return 'Check In';
    return status;
  };

  // Get status color
  const getStatusColor = (status) => {
    if (status === 'checked-out') {
      return "bg-green-100 text-green-700 border border-green-300";
    }
    return "bg-yellow-100 text-yellow-700 border border-yellow-300";
  };

  if (visitors.length === 0) {
    return (
      <div className="border border-[#7400EA] dark:border-[#7400EA] rounded-xl shadow-sm bg-white p-8 dark:bg-gray-900 text-center">
        <div className="text-4xl mb-3">👤</div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          No visitor records found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#7400EA] dark:border-[#7400EA] rounded-xl shadow-sm bg-white dark:bg-gray-900">
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Visitor Records ({visitors.length})
        </h3>
      </div>

      <div className="px-5">
        <div className="relative overflow-hidden rounded-lg">
          {/* Scrollable table container */}
          <div className="overflow-x-auto">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full text-sm text-left">
                  <colgroup>
                    <col className="w-[150px]" />
                    <col className="w-[120px]" />
                    <col className="w-[100px]" />
                    <col className="w-[80px]" />
                    <col className="w-[80px]" />
                    <col className="w-[100px]" />
                    <col className="w-[120px]" />
                  </colgroup>
                  {/* Table header */}
                  <thead className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
                    <tr>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left sticky left-0 bg-white dark:bg-gray-900 z-20">
                        Name
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Office
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Date
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Time In
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Time Out
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Status
                      </th>
                      <th className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 text-left">
                        Satisfaction
                      </th>
                    </tr>
                  </thead>
                </table>
                
                {/* Scrollable body */}
                <div className="overflow-y-auto max-h-80">
                  <table className="min-w-full text-sm text-left">
                    <colgroup>
                      <col className="w-[150px]" />
                      <col className="w-[120px]" />
                      <col className="w-[100px]" />
                      <col className="w-[80px]" />
                      <col className="w-[80px]" />
                      <col className="w-[100px]" />
                      <col className="w-[120px]" />
                    </colgroup>
                    <tbody>
                      {visitors.map((v, index) => (
                        <tr
                          key={v.id || index}
                          className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          <td className="py-3 px-4 text-gray-800 dark:text-gray-100 font-medium sticky left-0 bg-white dark:bg-gray-900 z-10">
                            <div className="font-medium">{v.name}</div>
                            {v.purpose && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {v.purpose}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {v.office}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {v.date}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {v.timeIn}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {v.timeOut}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(v.status)}`}
                            >
                              {formatStatus(v.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {renderStars(v.satisfaction)}
                              {v.satisfaction > 0 && (
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {v.satisfaction.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- FOOTER WITH SUMMARY --- */}
      <div className="p-5 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm text-gray-500 dark:text-gray-400 gap-2">
          <div>
            Showing {visitors.length} record{visitors.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span>Currently In: {visitors.filter(v => v.status === 'checked-in').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span>Checked Out: {visitors.filter(v => v.status === 'checked-out').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitorTable;