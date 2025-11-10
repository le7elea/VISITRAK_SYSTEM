import React, { useState, useEffect } from "react";
import NotificationItem from "./NotificationItem";
import { useVisitorData } from "../data/VisitorData";

const NotificationCard = ({ user = { type: "SuperAdmin", office: null } }) => {
  const { visitors } = useVisitorData(); // ✅ Shared visitor data hook
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (visitors.length > 0) {
      // 🏢 Filter visitors based on user type
      const filteredVisitors =
        user.type === "OfficeAdmin" && user.office
          ? visitors.filter(
              (v) => v.office.toLowerCase() === user.office.toLowerCase()
            )
          : visitors;

      // 🔔 Transform into notification format
      const notifData = filteredVisitors.map((v, index) => ({
        id: index + 1,
        name: v.name,
        office: v.office,
        date: v.date,
        timeIn: v.timeIn,
        isNew: true,
      }));

      setNotifications(notifData);
    }
  }, [visitors, user]);

  // ✅ Mark all notifications as read
  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isNew: false }))
    );
  };

  return (
    <section className="bg-white p-5 rounded-lg shadow mt-6 dark:bg-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-2 mb-3 border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
          Notification Feed
        </h3>
        <button
          onClick={markAllRead}
          className="px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {notifications.map((notif) => (
            <NotificationItem key={notif.id} {...notif} />
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          No notifications available for your office.
        </p>
      )}
    </section>
  );
};

export default NotificationCard;
