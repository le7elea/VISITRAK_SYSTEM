import React from "react";
import profileImg from "../assets/profile03.png";

const Topbar = ({ darkMode, setDarkMode, setActiveTab }) => {
  return (
    <header className="flex justify-end items-center gap-3 mb-5">
      {/* DARK MODE TOGGLE */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-lg mr-2"
      >
        {darkMode ? "☀" : "🌙"}
      </button>

      {/* NOTIFICATIONS */}
      <button
        onClick={() => setActiveTab("notifications")}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
      >
        🔔
        <span className="absolute top-1 right-1 bg-red-600 text-white text-xs font-semibold px-1.5 rounded-full">
          0
        </span>
      </button>

      {/* PROFILE BUTTON */}
      <button
        onClick={() => setActiveTab("profile")} // <-- keep this
        className="flex items-center gap-1 px-1 py-1"
      >
        <img
          src={profileImg}
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover"
        />
      </button>
    </header>
  );
};

export default Topbar;
