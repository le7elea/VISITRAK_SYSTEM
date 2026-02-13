// pages/Profile.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "../components/ProfileCard";
import Tabs from "../components/Tabs";
import InfoRow from "../components/InfoRow";
import { fetchOffices, updateOffice, getOfficeByEmail, getOfficeById } from "../lib/info.services";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  limit 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import profileImg from "../assets/bisulogo.png";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [user, setUser] = useState(null);
  const [offices, setOffices] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Date filtering states
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const navigate = useNavigate();
  const tabs = ["Overview", "Password", "History"];

  // Date filter options
  const dateFilterOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom Range" }
  ];

  // Helper function to normalize office names
  const normalizeOfficeName = (officeName) => {
    if (!officeName) return "";
    return officeName.toString().trim().toLowerCase();
  };

  // Enhanced user loading with SUPERADMIN SPECIAL HANDLING
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const savedUser = localStorage.getItem("user");
        
        if (!savedUser) {
          navigate('/login');
          return;
        }
        
        const parsedUser = JSON.parse(savedUser);
        console.log("🔍 Loading user data:", {
          email: parsedUser.email,
          type: parsedUser.type,
          role: parsedUser.role,
          id: parsedUser.id
        });
        
        const officesData = await fetchOffices();
        setOffices(officesData);
        
        let userOffice = null;
        
        // ========== SPECIAL HANDLING FOR SUPERADMIN ==========
        if (parsedUser.type === "SuperAdmin" || parsedUser.role === "super") {
          console.log("👑 SUPERADMIN DETECTED - Special handling");
          
          // For SuperAdmin, we have multiple strategies:
          
          // 1. FIRST: Try to find ANY super admin office (primary strategy)
          console.log("🔍 Strategy 1: Looking for any super admin office");
          userOffice = officesData.find(office => office.role === "super");
          
          if (userOffice) {
            console.log("✅ Found super admin office:", {
              name: userOffice.name,
              email: userOffice.email,
              id: userOffice.id
            });
            
            // Check if email matches - if not, we'll update localStorage
            if (userOffice.email !== parsedUser.email) {
              console.log("🔄 SuperAdmin email changed:", {
                old: parsedUser.email,
                new: userOffice.email
              });
            }
          }
          
          // 2. SECOND: If no super admin found, check if current user's ID exists
          if (!userOffice && parsedUser.id) {
            console.log("🔍 Strategy 2: Looking by ID:", parsedUser.id);
            userOffice = officesData.find(office => office.id === parsedUser.id);
          }
          
          // 3. THIRD: Try email lookup (might fail if email changed)
          if (!userOffice && parsedUser.email) {
            console.log("🔍 Strategy 3: Looking by email:", parsedUser.email);
            userOffice = officesData.find(
              office => office.email && office.email.toLowerCase() === parsedUser.email.toLowerCase()
            );
          }
        } else {
          // ========== REGULAR OFFICE ADMIN HANDLING ==========
          console.log("🏢 OFFICE ADMIN DETECTED");
          
          // Strategy 1: Try to find by ID first
          if (parsedUser.id) {
            console.log("🔍 Strategy 1: Looking up by ID:", parsedUser.id);
            userOffice = officesData.find(office => office.id === parsedUser.id);
            if (userOffice) {
              console.log("✅ Found user by ID:", userOffice.name);
            }
          }
          
          // Strategy 2: Try to find by email
          if (!userOffice && parsedUser.email) {
            console.log("🔍 Strategy 2: Looking up by email:", parsedUser.email);
            userOffice = officesData.find(
              office => office.email && office.email.toLowerCase() === parsedUser.email.toLowerCase()
            );
            if (userOffice) {
              console.log("✅ Found user by email:", userOffice.name);
            }
          }
          
          // Strategy 3: Use the info.services function
          if (!userOffice && parsedUser.email) {
            console.log("🔍 Strategy 3: Using getOfficeByEmail function");
            try {
              userOffice = await getOfficeByEmail(parsedUser.email);
              if (userOffice) {
                console.log("✅ Found user via getOfficeByEmail:", userOffice.name);
              }
            } catch (error) {
              console.log("getOfficeByEmail error:", error);
            }
          }
        }
        
        // ========== CREATE USER OBJECT ==========
        if (userOffice) {
          const type = userOffice.role === "super" ? "SuperAdmin" : "OfficeAdmin";
          
          const completeUser = {
            id: userOffice.id,
            name: userOffice.name,
            email: userOffice.email,
            role: userOffice.role,
            type: type,
            office: userOffice.name,
            password: userOffice.password || (type === "SuperAdmin" ? "superadmin2025" : "officeadmin2025"),
            createdAt: userOffice.createdAt,
            updatedAt: userOffice.updatedAt,
            isInDatabase: true
          };
          
          setUser(completeUser);
          
          // CRITICAL: Always update localStorage with current data
          const updatedUserData = {
            ...parsedUser,
            id: userOffice.id,
            name: userOffice.name,
            email: userOffice.email, // This updates the email if it changed!
            role: userOffice.role,
            office: userOffice.name,
            type: type
          };
          
          localStorage.setItem("user", JSON.stringify(updatedUserData));
          
          console.log("✅ User data loaded and localStorage updated:", {
            oldEmail: parsedUser.email,
            newEmail: userOffice.email,
            type: type,
            isSuperAdmin: type === "SuperAdmin"
          });
          
          await loadActivityLogs(completeUser);
        } else {
          console.log("⚠️ User not found in database");
          
          // For SuperAdmin specifically, we can create a fallback
          if (parsedUser.type === "SuperAdmin" || parsedUser.role === "super") {
            console.log("👑 Creating SuperAdmin fallback");
            
            // Check if there are ANY offices in the system
            console.log("📊 Total offices in system:", officesData.length);
            
            const fallbackUser = {
              id: parsedUser.id || "superadmin-fallback",
              name: parsedUser.name || "Super Administrator",
              email: parsedUser.email,
              role: "super",
              type: "SuperAdmin",
              office: "System Administration",
              password: "superadmin2025",
              createdAt: new Date(),
              isInDatabase: false,
              needsSetup: true,
              setupReason: "No super admin found in database"
            };
            
            setUser(fallbackUser);
            await loadActivityLogs(fallbackUser);
          } else {
            // Regular office admin fallback
            const fallbackUser = {
              id: parsedUser.id || "temp-" + Date.now(),
              name: parsedUser.name || parsedUser.office || "User",
              email: parsedUser.email,
              role: parsedUser.role || "office",
              type: parsedUser.type || "OfficeAdmin",
              office: parsedUser.office || "Not Assigned",
              password: parsedUser.type === "SuperAdmin" ? "superadmin2025" : "officeadmin2025",
              createdAt: new Date(),
              isInDatabase: false,
              needsSetup: true
            };
            
            setUser(fallbackUser);
            await loadActivityLogs(fallbackUser);
          }
        }
      } catch (error) {
        console.error("❌ Error loading user data:", error);
        
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const fallbackUser = {
            id: parsedUser.id || "error-fallback",
            name: parsedUser.name || parsedUser.office || "User",
            email: parsedUser.email,
            role: parsedUser.role || (parsedUser.type === "SuperAdmin" ? "super" : "office"),
            type: parsedUser.type || "OfficeAdmin",
            office: parsedUser.office || "Not Assigned",
            password: parsedUser.type === "SuperAdmin" ? "superadmin2025" : "officeadmin2025",
            createdAt: new Date(),
            isInDatabase: false,
            needsSetup: true
          };
          
          setUser(fallbackUser);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [navigate]);

  // Add a refresh function to manually reload user data
  const refreshUserData = async () => {
    setLoading(true);
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) {
        navigate('/login');
        return;
      }
      
      const parsedUser = JSON.parse(savedUser);
      
      // Clear old data and reload
      const officesData = await fetchOffices();
      setOffices(officesData);
      
      let userOffice = null;
      
      // Try all strategies again
      if (parsedUser.id) {
        userOffice = officesData.find(office => office.id === parsedUser.id);
      }
      
      if (!userOffice && parsedUser.email) {
        userOffice = officesData.find(
          office => office.email && office.email.toLowerCase() === parsedUser.email.toLowerCase()
        );
      }
      
      if (userOffice) {
        const type = userOffice.role === "super" ? "SuperAdmin" : "OfficeAdmin";
        const completeUser = {
          id: userOffice.id,
          name: userOffice.name,
          email: userOffice.email,
          role: userOffice.role,
          type: type,
          office: userOffice.name,
          password: userOffice.password || (type === "SuperAdmin" ? "superadmin2025" : "officeadmin2025"),
          createdAt: userOffice.createdAt,
          updatedAt: userOffice.updatedAt,
          isInDatabase: true
        };
        
        setUser(completeUser);
        
        localStorage.setItem("user", JSON.stringify({
          ...parsedUser,
          id: userOffice.id,
          name: userOffice.name,
          email: userOffice.email,
          role: userOffice.role,
          office: userOffice.name,
          type: type
        }));
        
        await loadActivityLogs(completeUser);
        console.log("✅ User data refreshed");
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    } finally {
      setLoading(false);
    }
  };

  // SuperAdmin-specific refresh function
  const refreshSuperAdmin = async () => {
    setLoading(true);
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      
      const parsedUser = JSON.parse(savedUser);
      
      // Force reload offices
      const officesData = await fetchOffices();
      setOffices(officesData);
      
      // Look for any super admin
      const superAdminOffice = officesData.find(office => office.role === "super");
      
      if (superAdminOffice) {
        const completeUser = {
          id: superAdminOffice.id,
          name: superAdminOffice.name,
          email: superAdminOffice.email,
          role: "super",
          type: "SuperAdmin",
          office: superAdminOffice.name,
          password: superAdminOffice.password || "superadmin2025",
          createdAt: superAdminOffice.createdAt,
          updatedAt: superAdminOffice.updatedAt,
          isInDatabase: true
        };
        
        setUser(completeUser);
        
        // Update localStorage with the correct email
        localStorage.setItem("user", JSON.stringify({
          ...parsedUser,
          id: superAdminOffice.id,
          name: superAdminOffice.name,
          email: superAdminOffice.email, // KEY: Update the email!
          role: "super",
          office: superAdminOffice.name,
          type: "SuperAdmin"
        }));
        
        console.log("✅ SuperAdmin refreshed with new email:", superAdminOffice.email);
        await loadActivityLogs(completeUser);
      } else {
        alert("No SuperAdmin found in the system!");
      }
    } catch (error) {
      console.error("Error refreshing SuperAdmin:", error);
      alert("Error refreshing: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async (userData) => {
    try {
      console.log("🔍 Loading activity logs for user:", {
        name: userData.name,
        email: userData.email,
        office: userData.office
      });
      
      // Load ALL logs first, then filter in memory
      const allLogsQuery = query(
        collection(db, "activityLogs"),
        orderBy("timestamp", "desc"),
        limit(10000)
      );
      
      const snapshot = await getDocs(allLogsQuery);
      
      const allLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = data.timestamp;
        let date = new Date();
        
        if (timestamp) {
          if (timestamp.toDate) {
            date = timestamp.toDate();
          } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
          }
        }
        
        return {
          id: doc.id,
          title: data.title || "Activity",
          description: data.description || "No description",
          office: data.office || "System",
          type: data.type || "info",
          userEmail: data.userEmail,
          userName: data.userName,
          date: date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          time: date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          fullDate: date,
          timestamp: date.getTime(),
          normalizedOffice: normalizeOfficeName(data.office)
        };
      });
      
      setActivityLogs(allLogs);
      
    } catch (error) {
      console.error("❌ Error loading activity logs:", error);
      setActivityLogs([]);
    }
  };

  const getDefaultPassword = () => {
    if (!user) return "";
    
    if (user.password) {
      return user.password;
    }
    
    return user.role === "super" ? "superadmin2025" : "officeadmin2025";
  };

  // Filter logs by date range
  const filterByDateRange = (logs) => {
    if (!logs || logs.length === 0) return [];
    
    const now = new Date();
    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    
    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    
    switch (dateFilter) {
      case "today":
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        return logs.filter(log => 
          log.timestamp >= todayStart.getTime() && 
          log.timestamp <= todayEnd.getTime()
        );
        
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStart = startOfDay(yesterday);
        const yesterdayEnd = endOfDay(yesterday);
        return logs.filter(log => 
          log.timestamp >= yesterdayStart.getTime() && 
          log.timestamp <= yesterdayEnd.getTime()
        ); 
        
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return logs.filter(log => log.timestamp >= weekStart.getTime());
        
      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return logs.filter(log => log.timestamp >= monthStart.getTime());
        
      case "custom":
        if (!customStartDate || !customEndDate) return logs;
        
        const start = startOfDay(new Date(customStartDate));
        const end = endOfDay(new Date(customEndDate));
        return logs.filter(log => 
          log.timestamp >= start.getTime() && 
          log.timestamp <= end.getTime()
        );
        
      default:
        return logs;
    }
  };

  const filteredHistoryData = useMemo(() => {
    if (!user) return [];
    
    // First filter by office/user role
    let filteredLogs = [];
    
    if (user.role === "super" || user.type === "SuperAdmin") {
      filteredLogs = [...activityLogs];
    } else {
      const userNormalizedOffice = normalizeOfficeName(user.office || user.name);
      const userNormalizedEmail = user.email ? user.email.toLowerCase() : "";
      
      filteredLogs = activityLogs.filter(log => {
        const logNormalizedOffice = log.normalizedOffice || normalizeOfficeName(log.office);
        const logNormalizedUserName = normalizeOfficeName(log.userName);
        const logUserEmail = log.userEmail ? log.userEmail.toLowerCase() : "";
        
        const matchesOffice = logNormalizedOffice === userNormalizedOffice;
        const matchesUserName = logNormalizedUserName === userNormalizedOffice;
        const createdByUser = logUserEmail === userNormalizedEmail;
        const systemLogForUser = logNormalizedOffice === "system" && createdByUser;
        const containsUserOffice = logNormalizedOffice.includes(userNormalizedOffice) || 
                                   userNormalizedOffice.includes(logNormalizedOffice);
        
        return matchesOffice || matchesUserName || createdByUser || systemLogForUser || containsUserOffice;
      });
    }
    
    // Then apply date filtering
    return filterByDateRange(filteredLogs);
  }, [user, activityLogs, dateFilter, customStartDate, customEndDate]);

  const officePersonalInfo = useMemo(() => {
    if (!user) return [];
    
    const baseInfo = [
      { label: "Full Name:", value: user.name || "Not set" },
      { label: "Email Address:", value: user.email || "Not set" },
      { label: "User Role:", value: user.role === "super" ? "Super Administrator" : "Office Administrator" },
    ];
    
    if (user.createdAt) {
      let dateStr = "N/A";
      try {
        let date;
        if (user.createdAt.toDate) {
          date = user.createdAt.toDate();
        } else if (user.createdAt.seconds) {
          date = new Date(user.createdAt.seconds * 1000);
        } else {
          date = new Date(user.createdAt);
        }
        
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (e) {}
      
      baseInfo.push({ label: "Account Created:", value: dateStr });
    }
    
    if (user.role === "office" || user.type === "OfficeAdmin") {
      baseInfo.push({ 
        label: "Assigned Office:", 
        value: user.office !== "Not Assigned" ? user.office : "Not assigned" 
      });
    } else {
      baseInfo.push({ label: "Department Office:", value: "Administrative Office" });
    }
    
    if (user.role === "super" || user.type === "SuperAdmin") {
      baseInfo.push({ label: "Access Level:", value: "Full System Access" });
      baseInfo.push({ label: "Managed Offices:", value: `${offices.length} Offices` });
    } else {
      baseInfo.push({ label: "Access Level:", value: "Office-Level Access" });
      baseInfo.push({ 
        label: "Permissions:", 
        value: user.office !== "Not Assigned" 
          ? `Manage ${user.office} office only` 
          : "No office permissions" 
      });
    }
    
    if (user.needsSetup) {
      baseInfo.push({ 
        label: "Setup Status:", 
        value: user.type === "SuperAdmin" 
          ? "SuperAdmin Sync Required" 
          : "Setup Required" 
      });
    }
    
    return baseInfo;
  }, [user, offices]);

  const officeUserData = useMemo(() => {
    if (!user) return { 
      name: "", 
      role: "", 
      location: "", 
      email: "", 
      status: "Active" 
    };
    
    const status = user.needsSetup ? "Setup Required" : "Active";
    
    return {
      name: user.name || "User",
      role: user.role === "super" ? "Super Administrator" : "Office Administrator",
      location: user.role === "office" && user.office !== "Not Assigned" ? user.office : "All Offices",
      email: user.email || "",
      status: status
    };
  }, [user]);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    if (!user || !user.id) {
      alert("User information not available");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match!");
      return;
    }
    
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long!");
      return;
    }
    
    if (!user.isInDatabase) {
      alert("User not found in database. Click Refresh or log out and log back in.");
      return;
    }
    
    const currentStoredPassword = getDefaultPassword();
    if (currentPassword !== currentStoredPassword) {
      alert("Current password is incorrect!");
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      await updateOffice({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: newPassword
      });
      
      setUser(prev => ({ ...prev, password: newPassword }));
      
      // Update localStorage
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        localStorage.setItem("user", JSON.stringify({
          ...parsedUser,
          password: newPassword
        }));
      }
      
      // Log activity
      try {
        await addDoc(collection(db, "activityLogs"), {
          title: "Password Changed",
          description: `${user.name} updated their password`,
          office: user.office || user.name,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          timestamp: serverTimestamp(),
          type: "password_change"
        });
        
        await loadActivityLogs(user);
      } catch (logError) {
        console.log("Activity log error:", logError);
      }
      
      alert("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
    } catch (error) {
      console.error("Error updating password:", error);
      alert(`Failed to update password: ${error.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  const groupLogsByDate = useMemo(() => {
    const grouped = {};
    
    filteredHistoryData.forEach(log => {
      const date = log.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(log);
    });
    
    return grouped;
  }, [filteredHistoryData]);

  // Handle custom date filter toggle
  const handleDateFilterChange = (value) => {
    setDateFilter(value);
    if (value !== "custom") {
      setShowCustomDatePicker(false);
    } else {
      setShowCustomDatePicker(true);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(end.toISOString().split('T')[0]);
    }
  };

  // Reset custom date filter
  const resetCustomDateFilter = () => {
    setCustomStartDate("");
    setCustomEndDate("");
    setDateFilter("all");
    setShowCustomDatePicker(false);
  };

  const SetupInstructions = () => (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-semibold text-yellow-700 mb-2">
        {user?.type === "SuperAdmin" ? "SuperAdmin Sync Required" : "Setup Required"}
      </h3>
      
      {user?.type === "SuperAdmin" ? (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Your SuperAdmin profile needs to sync with the database. This usually happens when you've changed your email.
          </p>
          <div className="space-y-3">
            <button
              onClick={refreshSuperAdmin}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync SuperAdmin Profile
            </button>
            <p className="text-xs text-gray-500">
              This will update your profile with the current SuperAdmin email from the database.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Your account needs to be re-synced with the system.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={refreshUserData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Profile Data
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Log Out & Log Back In
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Add refresh button to header
  const HeaderButtons = () => (
    <div className="flex items-center gap-3">
      {user?.needsSetup && (
        <button
          onClick={user?.type === "SuperAdmin" ? refreshSuperAdmin : refreshUserData}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {user?.type === "SuperAdmin" ? "Sync SuperAdmin" : "Refresh"}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-10">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-700 mb-2">No User Session</h2>
          <p className="text-gray-600 mb-4">Please log in to access your profile.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user.needsSetup && "Setup Required • "}
            {user.type === "SuperAdmin" && "System Administrator"}
            {user.type === "OfficeAdmin" && `${user.office} Office`}
            {user.needsSetup && " • Click Refresh above"}
          </p>
        </div>
        <HeaderButtons />
      </div>

      {user.needsSetup && <SetupInstructions />}

      <ProfileCard
        avatar={profileImg}
        name={officeUserData.name}
        role={officeUserData.role}
        location={officeUserData.location}
        status={officeUserData.status}
        email={officeUserData.email}
      />

      <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "Overview" && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-purple-200 mt-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-semibold text-lg">Personal Information</h2>
            <button
              onClick={user?.type === "SuperAdmin" ? refreshSuperAdmin : refreshUserData}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {user?.type === "SuperAdmin" ? "Sync" : "Refresh"}
            </button>
          </div>

          <div className="space-y-4">
            {officePersonalInfo.map((info, index) => (
              <InfoRow key={index} label={info.label} value={info.value} />
            ))}
          </div>
          
          {user.needsSetup && user.type === "SuperAdmin" && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Note for SuperAdmin:</strong> After changing your email in Offices, 
                click the "Sync" button above to update your profile with the new email.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "Password" && (
        <div className="bg-white dark:bg-gray-800 p-5 mt-4 rounded-xl shadow-md border border-purple-200">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <h2 className="text-xl font-semibold">Password</h2>
            </div>
            <button
              onClick={user?.type === "SuperAdmin" ? refreshSuperAdmin : refreshUserData}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {user?.type === "SuperAdmin" ? "Sync" : "Refresh"}
            </button>
          </div>

          {!user.isInDatabase ? (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 mb-3">
                <strong>Profile sync required.</strong> Your profile data needs to be refreshed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={user?.type === "SuperAdmin" ? refreshSuperAdmin : refreshUserData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {user?.type === "SuperAdmin" ? "Sync SuperAdmin Now" : "Refresh Profile Now"}
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Log Out & Log Back In
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-gray-600 text-sm">
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-medium mb-1">Current Password:</p>
                    <p className="font-mono text-lg">{getDefaultPassword()}</p>
                  </div>
                  {/* <div className="p-3 bg-blue-50 border border-blue-100 rounded">
                    <p className="text-sm text-blue-700">
                      <strong>Email:</strong> {user.email}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Ensure this matches your email in Offices
                    </p>
                  </div> */}
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <form onSubmit={handlePasswordUpdate}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Current Password *</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                        placeholder="Enter current password"
                        disabled={passwordLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">New Password *</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                        minLength="8"
                        placeholder="Minimum 8 characters"
                        disabled={passwordLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Confirm New Password *</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                          confirmPassword && newPassword !== confirmPassword
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-purple-500'
                        }`}
                        required
                        placeholder="Confirm your new password"
                        disabled={passwordLoading}
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match!</p>
                      )}
                    </div>

                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg shadow-md transition-all font-medium flex items-center gap-2 disabled:opacity-50"
                        disabled={passwordLoading}
                      >
                        {passwordLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Updating...
                          </>
                        ) : (
                          "Update Password"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "History" && (
        <div className="bg-white dark:bg-gray-800 p-5 mt-4 rounded-xl shadow-md border border-purple-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-semibold">Activity History</h2>
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter Dropdown */}
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => handleDateFilterChange(e.target.value)}
                  className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-sm font-medium"
                >
                  {dateFilterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              
              {/* Custom Date Range Picker */}
              {showCustomDatePicker && (
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-400">From:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      max={customEndDate || new Date().toISOString().split('T')[0]}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-400">To:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      min={customStartDate}
                      max={new Date().toISOString().split('T')[0]}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={resetCustomDateFilter}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 font-medium dark:text-red-400 dark:hover:text-red-600"
                  >
                    Reset
                  </button>
                </div>
              )}
              
              {/* Activity Count Badge */}
              <div className="flex items-center gap-3">
                {user.role === "super" ? (
                  <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-medium dark:from-purple-400 dark:to-purple-400">
                    All Offices
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full text-sm font-medium">
                    {user.office}
                  </span>
                )}
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {filteredHistoryData.length} activities
                </span>
              </div>
            </div>
          </div>

          {/* Filter Summary */}
          {dateFilter !== "all" && filteredHistoryData.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-gray-700 border border-purple-100 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-white">
                Showing activities for: <strong>{dateFilterOptions.find(opt => opt.value === dateFilter)?.label}</strong>
                {dateFilter === "custom" && customStartDate && customEndDate && (
                  <span> ({customStartDate} to {customEndDate})</span>
                )}
              </p>
            </div>
          )}

          {/* Scrollable Activities Container */}
          <div className="relative">
            {filteredHistoryData.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-100">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg mb-2">No activities found</p>
                <p className="text-gray-400 text-sm">
                  {dateFilter !== "all" 
                    ? `No activities found for the selected date range`
                    : user.role === "super" 
                    ? "Activities from all offices will appear here"
                    : `Activities for ${user.office} will appear here`}
                </p>
                {dateFilter !== "all" && (
                  <button
                    onClick={() => setDateFilter("all")}
                    className="mt-4 px-4 py-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    View all activities
                  </button>
                )}
              </div>
            ) : (
              <div 
                className="overflow-y-auto scroll-smooth"
                style={{ 
                  maxHeight: 'calc(100vh - 400px)',
                  minHeight: '200px'
                }}
              >
                <div className="space-y-8 pr-2">
                  {Object.entries(groupLogsByDate).map(([date, logs]) => (
                    <div key={date} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200"></div>
                        <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-full border border-purple-100">
                          <span className="text-purple-700 font-medium">{date}</span>
                        </div>
                        <div className="h-px flex-1 bg-gray-200"></div>
                      </div>
                      
                      <div className="space-y-4">
                        {logs.map((log, index) => (
                          <div 
                            key={log.id || index} 
                            className="group p-4 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-white transition-all duration-300 hover:shadow-md"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h3 className="font-medium text-gray-800 dark:text-white group-hover:text-purple-700 transition-colors">
                                    {log.title}
                                  </h3>
                                  {log.type && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      log.type === 'password_change' ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-purple-200 dark:text-black-300' :
                                      log.type === 'login' ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900 dark:text-green-300' :
                                      log.type === 'office_created' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                      log.type === 'office_updated' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                      log.type === 'office_deleted' ? 'bg-red-100 text-red-700 border border-red-200' :
                                      'bg-gray-100 text-gray-700 border border-gray-200'
                                    }`}>
                                      {log.type.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                  {user.role === "super" && log.office && log.office !== "System" && (
                                    <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 font-medium">
                                      📍 {log.office}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-600 text-sm mb-2">{log.description}</p>
                                {log.userEmail && (
                                  <p className="text-xs text-gray-500">
                                    By: {log.userName || log.userEmail}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-gray-500 text-sm">
                                  <span className="font-medium">{log.date}</span>
                                  <span className="block text-xs text-gray-400">{log.time}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Scroll indicator when content overflows */}
            {filteredHistoryData.length > 5 && (
              <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;