import React from "react";
import logo from "../assets/logo04.png";
import { LogOut } from "lucide-react";

const Sidebar = ({ 
  menu, 
  activeTab, 
  setActiveTab, 
  darkMode, 
  setShowConfirm // <-- used to open ConfirmModal 
}) => {
  return (
    <aside
      className={`w-64 h-full flex flex-col justify-between p-5 transition-all ${
        darkMode
          ? "bg-[#1f1f1f] text-gray-100 border-r border-gray-700"
          : "bg-gray-50 text-gray-800 border-r border-gray-200"
      }`}
    >
      {/* --- TOP SECTION --- */}
      <div>
        <div className="flex items-center gap-5 mb-6">
          <img src={logo} alt="VisiTrak" className="w-10 h-10" />
          <h2 className="text-3xl font-bold text-[#491D76] dark:text-white">
            VisiTrak
          </h2>
        </div>

        {/* MENU SECTIONS */}
        <Section
          title="Overview"
          tabs={menu.overview}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <Section
          title="Management"
          tabs={menu.management}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <Section
          title="Feedback"
          tabs={menu.feedback}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      {/* --- LOGOUT BUTTON (opens ConfirmModal) --- */}
      <button
        onClick={() => setShowConfirm(true)}
        className="
          w-full flex items-center justify-center gap-3 
          px-4 py-3 
          rounded-2xl 
          border border-purple-700 
          bg-[#f7f4fb]
          text-purple-800 
          font-medium
          hover:bg-purple-100 
          transition
        "
      >
        <LogOut size={22} strokeWidth={2.2} />
        <span>Logout</span>
      </button>
    </aside>
  );
};

/* ---------------------------------- */

const Section = ({ title, tabs, activeTab, setActiveTab }) => {
  // Remove notifications from sidebar
  const filteredTabs = tabs.filter((tab) => tab !== "notifications");

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2 uppercase">{title}</h4>

      <ul className="space-y-2">
        {filteredTabs.map((tab) => (
          <li
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer rounded-md px-3 py-2 transition-colors ${
              activeTab === tab
                ? "bg-[#491D76] text-white"
                : "hover:bg-[#A37ECA] dark:hover:bg-gray-700"
            }`}
          >
            {tab === "dashboard" && "📊 Dashboard"}
            {tab === "analytics" && "📈 Analytics"}
            {tab === "visitors" && "👥 Visitors"}
            {tab === "offices" && "🏢 Offices"}
            {tab === "feedback" && "💬 Feedback"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
