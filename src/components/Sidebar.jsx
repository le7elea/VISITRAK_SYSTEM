import React from "react";

const Sidebar = ({ menu, activeTab, setActiveTab, darkMode }) => {
  return (
    <aside
      className={`w-64 h-full flex-shrink-0 p-5 transition-all ${
        darkMode ? "bg-[#1f1f1f] text-gray-100 border-r border-gray-700" : "bg-gray-50 text-gray-800 border-r border-gray-200"
      }`}
    >
      <div className="flex items-center gap-3 mb-6"> 
        <img src="/src/assets/logo03.png" alt="VisiTrak" className="w-10 h-10" />
        <h2 className="text-xl font-bold text-[#491D76] dark:text-white">VisiTrak Admin</h2>
      </div>

      <div>
        <Section title="Overview" tabs={menu.overview} activeTab={activeTab} setActiveTab={setActiveTab} />
        <Section title="Management" tabs={menu.management} activeTab={activeTab} setActiveTab={setActiveTab} />
        <Section title="Feedback" tabs={menu.feedback} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </aside>
  );
};

const Section = ({ title, tabs, activeTab, setActiveTab }) => (
  <div className="mb-4">
    <h4 className="text-sm font-semibold mb-2 uppercase">{title}</h4>
    <ul className="space-y-2">
      {tabs.map((tab) => (
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
          {tab === "notifications" && "🔔 Notifications"}
          {tab === "visitors" && "👥 Visitors"}
          {tab === "offices" && "🏢 Offices"}
          {tab === "feedback" && "💬 Feedback"}
        </li>
      ))}
    </ul>
  </div>
);

export default Sidebar;
