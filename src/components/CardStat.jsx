// components/CardStat.jsx - UPDATED VERSION
import React from "react";
import { Users, CalendarDays, CheckCircle, BarChart3 } from "lucide-react";

const iconMap = {
  "Visitor Today": <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
  "Visitor This Week": <CalendarDays className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
  "Currently Checked-in": <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
  "Avg. Satisfaction": <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
};

const CardStat = ({ title, value, suffix = "" }) => (
  <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-[#7400EA] shadow-md hover:shadow-md transition-all duration-300 hover:scale-[1.02] dark:bg-gray-900 dark:text-gray-200">
    {/* Icon Section */}
    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
      {iconMap[title] || <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
    </div>

    {/* Text Section */}
    <div className="flex flex-col">
      <h3 className="text-sm text-gray-600 dark:text-gray-300">{title}</h3>
      <div className="flex items-baseline">
        <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
          {value ?? "—"}
        </p>
        {suffix && (
          <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  </div>
);

export default CardStat;