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
import Profile from "../pages/Profile";
import useAdminVisitors from "../hooks/useAdminVisitors";
import useFeedbackRatings from "../hooks/useFeedbackRatings";

const Dashboard = ({
  user = { type: "SuperAdmin", office: null },
  onLogout,
}) => {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("activeTab") || "dashboard"
  );
  const [showConfirm, setShowConfirm] = useState(false);

  const { visitors } = useAdminVisitors();
  const { feedbacks, loading: feedbacksLoading } = useFeedbackRatings();

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

  // 🧮 TODAY'S VISITORS (for Live Visitor Feed)
  const todaysVisitors = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return filteredVisitors.filter((v) => v.date === today);
  }, [filteredVisitors]);

  // 📊 TODAY'S VISITORS COUNT (for CardStat)
  const visitorsToday = useMemo(() => todaysVisitors.length, [todaysVisitors]);

  // 📆 Helper for "this week" visitors
  const visitorsThisWeek = useMemo(() => {
    const today = new Date();
    return filteredVisitors.filter((v) => {
      const visitorDate = new Date(v.date);
      if (isNaN(visitorDate.getTime())) {
        const [month, day, year] = v.date.split("/");
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          const diffDays = (today - parsedDate) / (1000 * 60 * 60 * 24);
          return diffDays <= 7 && diffDays >= 0;
        }
        return false;
      }
      const diffDays = (today - visitorDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= 0;
    }).length;
  }, [filteredVisitors]);

  // 🕒 Checked-in visitors
  const currentlyCheckedIn = useMemo(
    () => filteredVisitors.filter((v) => v.status === "Check In").length,
    [filteredVisitors]
  );

  // 🧮 Compute average satisfaction FROM FEEDBACKS averageRating field
  const avgSatisfaction = useMemo(() => {
    if (!feedbacks || feedbacks.length === 0) return "0.0";

    let relevantFeedbacks = feedbacks;

    // Filter feedbacks by office if needed
    if (user.type === "OfficeAdmin" && user.office) {
      // Since feedbacks might not have office field, let's try to match with visitors
      // Create a map of visitId to office from visitors
      const visitorOfficeMap = {};
      visitors.forEach((v) => {
        if (v.id) visitorOfficeMap[v.id] = v.office;
      });

      // Filter feedbacks where the corresponding visitor has the right office
      relevantFeedbacks = feedbacks.filter((f) => {
        const visitorOffice = visitorOfficeMap[f.visitId];
        return visitorOffice === user.office;
      });
    }

    if (relevantFeedbacks.length === 0) return "0.0";

    const totalRating = relevantFeedbacks.reduce(
      (sum, f) => sum + (f.averageRating || 0),
      0
    );
    const average = totalRating / relevantFeedbacks.length;

    return average.toFixed(1);
  }, [feedbacks, visitors, user.type, user.office]);

  // Format average satisfaction with /5 suffix
  const formattedAvgSatisfaction = useMemo(() => {
    if (feedbacksLoading) return "Loading...";
    return `${avgSatisfaction}/5`;
  }, [avgSatisfaction, feedbacksLoading]);

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
        setShowConfirm={setShowConfirm}
      />

      <div className="flex flex-col flex-1 min-h-screen">
        <main className="flex-1 p-6 overflow-y-auto">
          <Topbar
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            setActiveTab={setActiveTab}
          />

          {activeTab === "dashboard" && (
            <>
              {/* 📊 Statistics Section */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <CardStat title="Visitor Today" value={visitorsToday} />
                <CardStat title="Visitor This Week" value={visitorsThisWeek} />
                <CardStat
                  title="Currently Checked-in"
                  value={currentlyCheckedIn}
                />
                <CardStat
                  title="Avg. Satisfaction"
                  value={formattedAvgSatisfaction}
                />
              </div>

              {/* 🧍 Live Visitor Feed - Now showing only today's visitors */}
              <LiveVisitorFeed visitors={todaysVisitors} />
            </>
          )}

          {activeTab === "analytics" && (
            <Analytics visitors={filteredVisitors} feedbacks={feedbacks} />
          )}
          {activeTab === "visitors" && <Visitors user={user} />}
          {activeTab === "offices" && user.type === "SuperAdmin" && <Offices />}
          {activeTab === "feedback" && (
            <Feedback
              visitors={filteredVisitors}
              feedbacks={feedbacks}
              user={user}
            />
          )}
          {activeTab === "notifications" && <NotificationCard user={user} />}
          {activeTab === "profile" && (
            <Profile user={user} onLogout={onLogout} />
          )}

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