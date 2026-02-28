import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import profileImg from "../assets/bisulogo.png";
import { Sun, Moon, Bell, User, X, ChevronRight } from "lucide-react";
import VisitorInfoModal from "./VisitorInfoModal"; // Import the modal

const getNotificationStorageKeyBase = (user) =>
  user?.uid || user?.id || user?.email || "anonymous";

const Topbar = ({ darkMode, setDarkMode, setActiveTab, user = { type: "SuperAdmin", office: null } }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastViewedTime, setLastViewedTime] = useState(() => {
    const userKey = getNotificationStorageKeyBase(user);
    const saved = localStorage.getItem(`notificationLastViewedTime_${userKey}`);
    return saved ? new Date(saved) : null;
  });
  const [markedAsRead, setMarkedAsRead] = useState(() => {
    const userKey = getNotificationStorageKeyBase(user);
    const saved = localStorage.getItem(`markedAsReadNotifications_${userKey}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previousCount, setPreviousCount] = useState(0);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // Get user from prop or localStorage as fallback
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    let userToUse = user;
    
    if (!userToUse || !userToUse.office) {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        try {
          userToUse = JSON.parse(savedUser);
        } catch (error) {
          console.error("❌ Error parsing user from localStorage:", error);
        }
      }
    }
    
    setCurrentUser(userToUse);
    
    if (!userToUse) {
      setLoading(false);
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const setupNotificationListener = () => {
      try {
        const visitsRef = collection(db, "visits");
        
        const isOfficeAdmin = currentUser.type === "OfficeAdmin";
        const userOffice = currentUser.office?.trim();
        const hasOffice = userOffice && userOffice !== "";
        
        let q;
        
        if (isOfficeAdmin && hasOffice) {
          // Avoid composite-index dependency for office-filtered listener.
          q = query(
            visitsRef,
            where("office", "==", userOffice)
          );
        } else {
          q = query(visitsRef, orderBy("checkInTime", "desc"));
        }
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          let count = 0;
          let latestVisitor = null;
          let latestVisitorData = null;
          let latestVisitorTimeMs = -1;
          const compareTime = lastViewedTime || new Date(Date.now() - (24 * 60 * 60 * 1000));
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            
            if (isOfficeAdmin && hasOffice) {
              const docOffice = data.office?.trim();
              if (docOffice !== userOffice) {
                return;
              }
            }
            
            let checkInDate = new Date();
            if (data.checkInTime instanceof Timestamp) {
              checkInDate = data.checkInTime.toDate();
            } else if (data.checkInTime && data.checkInTime.toDate) {
              checkInDate = data.checkInTime.toDate();
            } else if (data.checkInTime) {
              checkInDate = new Date(data.checkInTime);
            }
            
            const checkInTimeMs = Number.isNaN(checkInDate.getTime())
              ? 0
              : checkInDate.getTime();
            const isAfterLastViewed = checkInDate > compareTime;
            const isNotMarkedRead = !markedAsRead.includes(doc.id);
            
            if (isAfterLastViewed && isNotMarkedRead) {
              count++;
              if (checkInTimeMs > latestVisitorTimeMs) {
                latestVisitorTimeMs = checkInTimeMs;
                latestVisitor = {
                  name: data.visitorName || data.name || "Unknown Visitor",
                  office: data.office || "Unknown Office"
                };
                
                // Store full visitor data for modal
                latestVisitorData = {
                  id: doc.id,
                  name: data.visitorName || data.name || "N/A",
                  contactNumber: data.contactNumber || "N/A",
                  address: data.address || "N/A",
                  office: data.office || "N/A",
                  purpose: data.purpose || "N/A",
                  staffName: data.staffName || "N/A",
                  date: checkInDate.toLocaleDateString(),
                  timeIn: checkInDate.toLocaleTimeString(),
                  status: data.status || "checked-in"
                };
              }
            }
          });
          
          if (!loading && count > previousCount && latestVisitor && latestVisitorData) {
            const shouldShowToast = !isOfficeAdmin || latestVisitor.office === userOffice;
            
            if (shouldShowToast) {
              playNotificationSound();
              setToastMessage(`${latestVisitor.name} checked in at ${latestVisitor.office}`);
              setSelectedVisitor(latestVisitorData);
              setShowToast(true);
              
              setTimeout(() => {
                setShowToast(false);
              }, 5000);
            }
          }
          
          setPreviousCount(count);
          setUnreadCount(count);
          setLoading(false);
          
        }, (error) => {
          console.error("❌ Firestore onSnapshot error:", error);
          setLoading(false);
        });
        
      } catch (error) {
        console.error("❌ Setup error:", error);
        setLoading(false);
      }
    };

    setupNotificationListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, currentUser?.type, currentUser?.office, lastViewedTime, markedAsRead, loading, previousCount]);

  // Listen for changes to markedAsReadNotifications in localStorage (user-specific)
  useEffect(() => {
    const userKey = getNotificationStorageKeyBase(currentUser);
    if (!userKey) return;

    const storageKey = `markedAsReadNotifications_${userKey}`;
    
    const handleStorageChange = () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setMarkedAsRead(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const saved = localStorage.getItem(storageKey);
      const savedArray = saved ? JSON.parse(saved) : [];
      
      if (JSON.stringify(savedArray) !== JSON.stringify(markedAsRead)) {
        setMarkedAsRead(savedArray);
      }
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [markedAsRead, currentUser?.email, currentUser?.uid, currentUser?.id]);

  // Listen for changes to lastViewedTime in localStorage (user-specific)
  useEffect(() => {
    const userKey = getNotificationStorageKeyBase(currentUser);
    if (!userKey) return;

    const storageKey = `notificationLastViewedTime_${userKey}`;
    
    const handleStorageChange = () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setLastViewedTime(new Date(saved));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const saved = localStorage.getItem(storageKey);
      const savedDate = saved ? new Date(saved) : null;
      
      if (savedDate && (!lastViewedTime || savedDate.getTime() !== lastViewedTime.getTime())) {
        setLastViewedTime(savedDate);
      }
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [lastViewedTime, currentUser?.email, currentUser?.uid, currentUser?.id]);

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  };

  // Handle opening modal from toast
  const handleViewDetails = () => {
    setShowToast(false);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Modern Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slideIn">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 shadow-xl rounded-xl p-4 max-w-sm border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                  <Bell className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    New Visitor Check-in
                  </h4>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    Just now
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {toastMessage}
                </p>
              </div>
              
              <button
                onClick={() => setShowToast(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ml-1"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <button 
                onClick={handleViewDetails}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
              >
                View details
                <ChevronRight className="w-3 h-3" />
              </button>
              <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-shrink" style={{width: '100%'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visitor Info Modal */}
      <VisitorInfoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        visitorData={selectedVisitor}
      />

      <header className="flex justify-end items-center gap-4 mb-6">
        {/* Modern Theme Toggle */}
        <div className="relative">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 text-gray-700 dark:text-gray-300 hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all duration-300 hover:shadow-lg hover:scale-105 group border border-gray-100 dark:border-gray-700"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <Sun className="w-5 h-5 transition-transform group-hover:rotate-45" />
            ) : (
              <Moon className="w-5 h-5 transition-transform group-hover:rotate-12" />
            )}
          </button>
          
          {/* Hover Tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50">
            <div className="bg-gray-900 text-white text-xs font-medium py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap">
              {darkMode ? "Light Mode" : "Dark Mode"}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
            </div>
          </div>
        </div>

        {/* Enhanced Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setActiveTab("notifications")}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 text-gray-700 dark:text-gray-300 hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all duration-300 hover:shadow-lg hover:scale-105 group relative border border-gray-100 dark:border-gray-700"
            aria-label={`View notifications (${unreadCount} unread)`}
          >
            <Bell className="w-5 h-5 transition-transform group-hover:animate-bell" />
            
            {/* Notification Badge */}
            {!loading && unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5">
                <span className="relative flex">
                  <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-red-400 opacity-75"></span>
                  <span className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg ${unreadCount > 99 ? 'text-[9px] min-w-[22px] h-5 px-1' : unreadCount > 9 ? 'text-[10px] min-w-[20px] h-5' : 'text-xs w-5 h-5'}`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </span>
              </span>
            )}
          </button>
          
          {/* Hover Tooltip with Info */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50">
            <div className="bg-gray-900 text-white text-xs font-medium py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap min-w-[140px]">
              <div className="flex items-center justify-between mb-1">
                <span>Notifications</span>
                {!loading && unreadCount > 0 && (
                  <span className="text-red-300 font-bold">{unreadCount} new</span>
                )}
              </div>
              {currentUser?.type === "OfficeAdmin" && currentUser?.office && (
                <div className="text-[10px] text-gray-300 border-t border-gray-700 pt-1 mt-1">
                  {currentUser.office} office
                </div>
              )}
              {currentUser?.type === "SuperAdmin" && (
                <div className="text-[10px] text-gray-300 border-t border-gray-700 pt-1 mt-1">
                  All offices
                </div>
              )}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
            </div>
          </div>
        </div>

        {/* Enhanced Profile Button */}
        <div className="relative">
          <button
            onClick={() => setActiveTab("profile")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all duration-300 hover:shadow-lg group border border-gray-100 dark:border-gray-700"
            aria-label="View profile"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-500 transition-colors">
                <img
                  src={profileImg}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            </div>
            
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">
                {currentUser?.name || "User"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {currentUser?.type === "SuperAdmin" ? "Super Admin" : 
                 currentUser?.type === "OfficeAdmin" ? "Office Admin" : "User"}
              </span>
            </div>
            
            <div className="hidden md:block ml-1">
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
          
          {/* Hover Tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50">
            <div className="bg-gray-900 text-white text-xs font-medium py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap">
              View Profile
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
            </div>
          </div>
        </div>
      </header>
    
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        @keyframes bell {
          0%, 100% { transform: rotate(0); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(10deg); }
          20%, 40%, 60%, 80% { transform: rotate(-10deg); }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .animate-shrink {
          animation: shrink 5s linear;
        }
        
        .animate-bell {
          animation: bell 0.5s ease-in-out;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
};

export default Topbar;
