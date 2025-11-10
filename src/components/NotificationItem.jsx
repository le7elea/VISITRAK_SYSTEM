import React from "react";

const NotificationItem = ({ name, office, date, timeIn, isNew }) => {
  return (
    <li className="flex justify-between items-center py-3 border-b last:border-none border-gray-200 dark:border-gray-700">
      <div>
        <p className="font-medium text-gray-800 dark:text-gray-100">
          {name}{" "}
          <span className="text-gray-500 dark:text-gray-400 font-normal">
            - {office}
          </span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {date} • {timeIn}
        </p>
      </div>
      {isNew && (
        <span className="text-[11px] font-semibold bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
          New
        </span>
      )}
    </li>
  );
};

export default NotificationItem;
