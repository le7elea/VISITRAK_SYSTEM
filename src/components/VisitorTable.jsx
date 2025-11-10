import React from "react";

const VisitorTable = ({ visitors, renderStars }) => {
  return (
    <div className="border border-[#7400EA] dark:border-[#7400EA] rounded-xl shadow-sm bg-white p-5 dark:bg-gray-900">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Visitor Records
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-700">
            <tr>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Office</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Time In</th>
              <th className="py-3 px-4">Time Out</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Satisfaction</th>
            </tr>
          </thead>

          <tbody>
            {visitors.map((v, i) => (
              <tr
                key={i}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                <td className="py-3 px-4">{v.name}</td>
                <td className="py-3 px-4">{v.office}</td>
                <td className="py-3 px-4">{v.date}</td>
                <td className="py-3 px-4">{v.timeIn}</td>
                <td className="py-3 px-4">{v.timeOut}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      v.status === "Check In"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                        : "bg-green-100 text-green-700 border border-green-300"
                    }`}
                  >
                    {v.status}
                  </span>
                </td>
                <td className="py-3 px-4">{renderStars(v.satisfaction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VisitorTable;
