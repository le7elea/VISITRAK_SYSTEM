import React from "react";

const Topbar = ({ darkMode, setDarkMode, setActiveTab, setShowConfirm }) => {
  return (
    <header className="flex justify-end items-center gap-3 mb-5">
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-lg"
      >
        {darkMode ? "☀" : "🌙"}
      </button>

      <button
        onClick={() => setActiveTab("notifications")}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
      >
        🔔
        <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-semibold px-1.5 rounded-full">
          0
        </span>
      </button>

      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-sm"
      >
        🚪 Logout
      </button>
    </header>
  );
};

export default Topbar;
