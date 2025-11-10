import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CardStat from "../components/CardStat";
import LiveVisitorFeed from "../components/LiveVisitorFeed";
import NotificationCard from "../components/NotificationCard";
import ConfirmModal from "../components/ConfirmModal";
import Analytics from "../pages/Analytics";
import Visitors from "../pages/Visitors";
import Offices from "../pages/Offices";
import Feedback from "../pages/Feedback";
import Footer from "../components/Footer";
import { useVisitorData } from "../data/VisitorData";

const Dashboard = ({
  user = { type: "SuperAdmin", office: null },
  onLogout,
}) => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("activeTab") || "dashboard");
  const [showConfirm, setShowConfirm] = useState(false);

  const { visitors } = useVisitorData(); // ✅ Shared visitor data

  useEffect(() => localStorage.setItem("darkMode", darkMode), [darkMode]);
  useEffect(() => localStorage.setItem("activeTab", activeTab), [activeTab]);

  // 🧭 MENU CONFIG
  const menuConfig = {
    SuperAdmin: {
      overview: ["dashboard", "analytics", "notifications"],
      management: ["visitors", "offices"],
      feedback: ["feedback"],
    },
    OfficeAdmin: {
      overview: ["dashboard", "analytics", "notifications"],
      management: ["visitors"],
      feedback: ["feedback"],
    },
  };

  const menu = menuConfig[user.type] || menuConfig.OfficeAdmin;

  // 🏢 Filter visitors based on user office (for OfficeAdmin)
  const filteredVisitors = useMemo(() => {
    return user.type === "OfficeAdmin"
      ? visitors.filter((v) => v.office === user.office)
      : visitors;
  }, [visitors, user]);

  // 🧮 Compute average satisfaction
  const avgSatisfaction =
    filteredVisitors.length > 0
      ? (
          filteredVisitors.reduce((sum, v) => sum + (v.satisfaction || 0), 0) /
          filteredVisitors.length
        ).toFixed(1)
      : 0;

  // 📅 Helper for "today" visitors
  const visitorsToday = filteredVisitors.filter((v) => {
    const today = new Date().toLocaleDateString();
    return v.date === today;
  }).length;

  // 📆 Helper for "this week" visitors
  const visitorsThisWeek = filteredVisitors.filter((v) => {
    const today = new Date();
    const visitorDate = new Date(v.date);
    const diffDays = (today - visitorDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length;

  // 🕒 Checked-in visitors
  const currentlyCheckedIn = filteredVisitors.filter(
    (v) => v.status === "Check In"
  ).length;

  return (
    <div
      className={`flex h-screen transition-colors ${
        darkMode ? "dark bg-[#1f1f1f] text-white" : "bg-white text-gray-900"
      }`}
    >
      <Sidebar
        menu={menu}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
      />

      <div className="flex flex-col flex-1 min-h-screen">
        <main className="flex-1 p-6 overflow-y-auto">
          <Topbar
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            setActiveTab={setActiveTab}
            setShowConfirm={setShowConfirm}
          />

          {activeTab === "dashboard" && (
            <>
              {/* 📊 Statistics Section */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <CardStat title="Visitor Today" value={visitorsToday} />
                <CardStat title="Visitor This Week" value={visitorsThisWeek} />
                <CardStat title="Currently Checked-in" value={currentlyCheckedIn} />
                <CardStat title="Avg. Satisfaction" value={avgSatisfaction} />
              </div>

              {/* 🧍 Live Visitor Feed */}
              <LiveVisitorFeed visitors={filteredVisitors} />
            </>
          )}

          {activeTab === "analytics" && <Analytics visitors={filteredVisitors} />}
          {activeTab === "visitors" && <Visitors user={user} />}
          {activeTab === "offices" && user.type === "SuperAdmin" && <Offices />}
          {activeTab === "feedback" && <Feedback visitors={filteredVisitors} user={user} />}
          {activeTab === "notifications" && <NotificationCard user={user} />}

          {/* 🔒 Logout Confirmation Modal */}
          {showConfirm && (
            <ConfirmModal
              onConfirm={() => {
                onLogout?.();
                setShowConfirm(false);
              }}
              onCancel={() => setShowConfirm(false)}
            />
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Dashboard;
