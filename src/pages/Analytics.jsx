import React, { useState, useMemo, useEffect } from 'react';
import { BarChart2, ChevronDown, MoreHorizontal, Download, MessageSquare, Calendar, FileText, Printer } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import bisuLogo from '../assets/bisulogo.png';
import bagongPilipinasLogo from '../assets/bagong_pilipinas_logo.png';
import tuvISOLogo from '../assets/tuvISO_logo.png';

const calculateSatisfactionRates = (feedbacks = []) => {
  const total = feedbacks.length;
  if (total === 0) return [];

  const counts = {
    verySatisfied: feedbacks.filter(f => (f.averageRating || 0) >= 4.5).length,
    satisfied: feedbacks.filter(f => (f.averageRating || 0) >= 4.0 && (f.averageRating || 0) < 4.5).length,
    neutral: feedbacks.filter(f => (f.averageRating || 0) >= 3.0 && (f.averageRating || 0) < 4.0).length,
    unsatisfied: feedbacks.filter(f => (f.averageRating || 0) >= 2.0 && (f.averageRating || 0) < 3.0).length,
    veryUnsatisfied: feedbacks.filter(f => (f.averageRating || 0) < 2.0).length,
  };

  return [
    { label: 'Very Satisfied', pct: Math.round((counts.verySatisfied / total) * 100), emoji: '🤩', color: 'bg-yellow-400' },
    { label: 'Satisfied', pct: Math.round((counts.satisfied / total) * 100), emoji: '😄', color: 'bg-yellow-400' },
    { label: 'Neutral', pct: Math.round((counts.neutral / total) * 100), emoji: '😐', color: 'bg-yellow-400' },
    { label: 'Unsatisfied', pct: Math.round((counts.unsatisfied / total) * 100), emoji: '😟', color: 'bg-green-100' },
    { label: 'Very unsatisfied', pct: Math.round((counts.veryUnsatisfied / total) * 100), emoji: '😡', color: 'bg-green-100' },
  ];
};

const calculateTrafficByDay = (visits = []) => {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const counts = days.map(() => 0);
  
  visits.forEach(visit => {
    if (!visit?.checkInTime) return;
    
    try {
      // Use checkInTime timestamp from visits collection
      const checkInDate = visit.checkInTime.toDate ? visit.checkInTime.toDate() : new Date(visit.checkInTime);
      if (isNaN(checkInDate.getTime())) return;
      
      const dayIndex = (checkInDate.getDay() + 6) % 7; // Monday=0
      counts[dayIndex]++;
    } catch (error) {
      console.error('Error parsing check-in date:', visit.checkInTime, error);
    }
  });

  const maxCount = Math.max(...counts, 1);
  
  return days.map((day, index) => ({
    day,
    value: Math.round((counts[index] / maxCount) * 100),
    count: counts[index],
    full: 100
  }));
};

// Helper function to normalize office names - UPDATED
const normalizeOfficeName = (officeName) => {
  if (!officeName) return "";
  let normalized = officeName.toString().trim();
  normalized = normalized.replace(/\s+/g, ' '); // Replace multiple spaces with single space
  // Don't remove special characters like / - just normalize spaces
  return normalized;
};

// Add a comparison function that's more flexible
const compareOfficeNames = (office1, office2) => {
  if (!office1 || !office2) return false;
  
  // Convert to lowercase and trim
  const name1 = office1.toString().trim().toLowerCase();
  const name2 = office2.toString().trim().toLowerCase();
  
  // Try exact match first
  if (name1 === name2) return true;
  
  // Try removing extra spaces and special characters for comparison
  const clean1 = name1.replace(/\s+/g, ' ').replace(/[^\w\s/.-]/g, '');
  const clean2 = name2.replace(/\s+/g, ' ').replace(/[^\w\s/.-]/g, '');
  
  return clean1 === clean2;
};

// Get user from localStorage - UPDATED
const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    
    // Ensure office is properly normalized (but keep original for display)
    if (user.office) {
      user.originalOffice = user.office; // Keep original
      user.office = normalizeOfficeName(user.office);
      user.normalizedOffice = user.office.toLowerCase();
    }
    
    return user;
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
    return null;
  }
};

// --- Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const VisitorTrafficChart = ({ trafficData }) => {
  // Check if there's any visitor data at all
  const totalVisitors = trafficData.reduce((sum, day) => sum + day.count, 0);
  
  if (totalVisitors === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <BarChart2 className="text-[#6B46C1]" size={20} />
            <h3 className="font-bold text-gray-800">Visitor Traffic</h3>
          </div>
          <MoreHorizontal className="text-gray-400 cursor-pointer" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 py-8">
            <BarChart2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">No visitors during this period</p>
            <p className="text-sm text-gray-500 mt-1">Visitor traffic will appear here when visitors check in</p>
          </div>
        </div>
      </div>
    );
  }

  const getBarColor = (value, count) => {
    if (count === 0) return 'bg-gray-200 group-hover:bg-gray-300';
    if (value >= 60) return 'bg-[#6B46C1] group-hover:bg-[#5B34B8]';
    if (value >= 30) return 'bg-[#7C5CCA] group-hover:bg-[#6B46C1]';
    return 'bg-[#A48CD8] group-hover:bg-[#7C5CCA]';
  };

  return (
    <div className="h-full flex flex-col ">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-[#6B46C1]" size={20} />
          <h3 className="font-bold text-gray-800 dark:text-white">Visitor Traffic</h3>
        </div>
        <MoreHorizontal className="text-gray-400 cursor-pointer" />
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 h-64">
        <div className="flex flex-col justify-between h-full text-[10px] sm:text-xs text-gray-400 pb-8 pr-2">
          <span>500</span>
          <span>400</span>
          <span>300</span>
          <span>200</span>
          <span>100</span>
          <span>0</span>
        </div>

        <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 h-full pb-8">
          {trafficData.map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1 group relative h-full">
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap">
                  {item.count} visitor{item.count !== 1 ? 's' : ''}
                </div>
                <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto -mt-1"></div>
              </div>

              <div className="w-full h-full flex flex-col justify-end items-center">
                <div className="relative w-4 sm:w-6 md:w-8 bg-gray-100 rounded-full overflow-hidden transition-all duration-300"
                     style={{ height: `${item.count > 0 ? item.value : 5}%` }}>
                   <div 
                    className={`absolute inset-0 w-full rounded-full transition-all duration-500 ${getBarColor(item.value, item.count)}`}
                   ></div>
                </div>
              </div>
              
              <span className={`text-[10px] ${item.count === 0 ? 'text-gray-300' : 'text-gray-400'} mt-2 font-medium absolute -bottom-6`}>
                {item.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SatisfactionChart = ({ ratings }) => {
  return (
    <div className="h-full flex flex-col ">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100">
             <span className="text-xs">⚖️</span> 
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Satisfaction Rate</h3>
        </div>
        <MoreHorizontal className="text-gray-400 cursor-pointer" />
      </div>

      <div className="flex flex-col gap-5 justify-center h-full">
        {ratings.length > 0 ? (
          ratings.map((item, idx) => (
            <div key={idx} className="w-full">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-lg">{item.emoji}</span>
                <span className="text-xs font-bold text-gray-700 w-24">{item.label}</span>
                <div className="flex-1 h-2 bg-green-50 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full rounded-full ${idx < 3 ? 'bg-yellow-400' : 'bg-[#D1FADF]'}`}
                    style={{ width: `${item.pct}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-gray-600 w-8 text-right">{item.pct}%</span>
                <span className="text-[10px] text-gray-300 hidden sm:block">Rate</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-50 mx-auto mb-3">
              <span className="text-xl">😊</span>
            </div>
            <p className="text-gray-600">No satisfaction data available</p>
            <p className="text-sm text-gray-500 mt-1">Ratings will appear here when visitors submit feedback</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Component with Office Filtering ---
const Analytics = () => {
  // State for visits from database
  const [visits, setVisits] = useState([]);
  // State for feedbacks from database
  const [feedbacks, setFeedbacks] = useState([]);
  // State for office metadata (official names)
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Get current user on component mount
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    
    if (!user) {
      console.warn("⚠️ No user found in localStorage");
    } else {
      console.log("👤 Current user:", user);
      console.log("🏢 User office - Original:", user.originalOffice, "Normalized:", user.office);
    }
  }, []);

  // Fetch office records so print header can use official office names
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "offices"), (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || "",
          officialName: d.officialName || "",
          role: d.role || "",
          email: d.email || "",
        };
      });

      setOffices(data);
    }, (error) => {
      console.error("Error fetching offices:", error);
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Fetch ALL visits (simplified approach)
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    console.log("🔄 Starting visits fetch for:", currentUser.type, currentUser.originalOffice || currentUser.office);
    
    // Fetch all visits
    const visitsQuery = query(collection(db, "visits"), orderBy("checkInTime", "desc"));
    
    const visitsUnsub = onSnapshot(visitsQuery, (visitsSnapshot) => {
      const allVisits = visitsSnapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          visitorId: d.visitorId,
          visitorName: d.visitorName,
          office: d.office,
          checkInTime: d.checkInTime,
          checkOutTime: d.checkOutTime,
          purpose: d.purpose || '',
          status: d.status || 'checked-in'
        };
      });
      
      console.log(`📊 Fetched ${allVisits.length} total visits from Firestore`);
      
      // Filter visits by office if OfficeAdmin
      let filteredVisits = allVisits;
      if (currentUser && currentUser.type === "OfficeAdmin" && currentUser.office) {
        const userOffice = currentUser.originalOffice || currentUser.office;
        console.log(`🏢 Filtering visits for office: "${userOffice}"`);
        
        filteredVisits = allVisits.filter(visit => {
          if (!visit.office) return false;
          
          // Use flexible comparison
          const matches = compareOfficeNames(visit.office, userOffice);
          if (matches) {
            console.log(`✅ Visit ${visit.id} matches office:`, visit.office);
          }
          return matches;
        });
        
        console.log(`🏢 After filtering: ${filteredVisits.length} visits for this office`);
        
        // Debug: Show unique office names found
        const uniqueOffices = [...new Set(filteredVisits.map(v => v.office).filter(Boolean))];
        console.log("📊 Unique offices in filtered visits:", uniqueOffices);
        
        // Also show all offices in database for debugging
        const allUniqueOffices = [...new Set(allVisits.map(v => v.office).filter(Boolean))];
        console.log("📊 All offices in database:", allUniqueOffices);
      } else {
        console.log("👑 SuperAdmin: Keeping all visits");
      }
      
      setVisits(filteredVisits);
      setLoading(false);
    }, (error) => {
      console.error("❌ Error fetching visits:", error);
      setLoading(false);
    });
    
    return () => {
      console.log("🧹 Cleaning up visits listener");
      if (visitsUnsub) visitsUnsub();
    };
  }, [currentUser]);

  // Fetch feedbacks from Firestore with office filtering - FIXED VERSION
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const fetchFeedbacks = () => {
      try {
        if (currentUser && currentUser.type === "OfficeAdmin" && currentUser.office) {
          console.log(`📝 Fetching feedbacks for office: "${currentUser.originalOffice || currentUser.office}"`);
          
          // Get the actual office name that might be stored in Firestore
          const userOffice = currentUser.originalOffice || currentUser.office;
          
          // First, we need to get visits for this office to get the visit IDs
          // We'll use the visits already fetched in state, but make sure they're loaded
          if (visits.length === 0) {
            console.log("📝 No visits loaded yet, waiting...");
            return;
          }
          
          console.log(`📊 Using ${visits.length} visits for feedback filtering`);
          
          // Get visit IDs for this office
          const officeVisitIds = visits.map(v => v.id);
          
          console.log(`🏢 Found ${officeVisitIds.length} visit IDs for this office`);
          
          if (officeVisitIds.length === 0) {
            console.log("📝 No visits found for this office, setting empty feedbacks");
            setFeedbacks([]);
            return;
          }
          
          // Now fetch ALL feedbacks
          const feedbackQuery = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
          
          const feedbackUnsub = onSnapshot(feedbackQuery, (feedbackSnapshot) => {
            const allFeedbacks = feedbackSnapshot.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                visitId: d.visitId,
                name: d.name,
                answers: d.answers || [],
                averageRating: d.averageRating || 0,
                suggestion: d.suggestion || "",
                createdAt: d.createdAt,
              };
            });
            
            console.log(`📝 Fetched ${allFeedbacks.length} total feedbacks from Firestore`);
            
            // Filter feedbacks by office visit IDs
            const filteredData = allFeedbacks.filter(feedback => 
              officeVisitIds.includes(feedback.visitId)
            );
            
            console.log(`📝 After filtering: ${filteredData.length} feedbacks for office "${userOffice}"`);
            
            // Debug: Show which visits have feedback
            const visitsWithFeedback = new Set(filteredData.map(f => f.visitId));
            console.log(`📝 ${visitsWithFeedback.size} visits have feedback`);
            
            setFeedbacks(filteredData);
          }, (error) => {
            console.error("❌ Error fetching feedbacks:", error);
          });
          
          return () => {
            if (feedbackUnsub) feedbackUnsub();
          };
        } else {
          // SuperAdmin or no office: Fetch all feedbacks
          console.log("📝 Fetching all feedbacks (SuperAdmin)");
          const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
          
          const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                visitId: d.visitId,
                name: d.name,
                answers: d.answers || [],
                averageRating: d.averageRating || 0,
                suggestion: d.suggestion || "",
                createdAt: d.createdAt,
              };
            });
            
            console.log(`📝 Fetched ${data.length} feedbacks`);
            setFeedbacks(data);
          }, (error) => {
            console.error("Error fetching feedbacks:", error);
          });

          return () => {
            if (unsub) unsub();
          };
        }
      } catch (error) {
        console.error("Error setting up feedbacks listener:", error);
      }
    };

    fetchFeedbacks();
  }, [currentUser, visits]); // Added visits dependency

  // --- State for date range ---
  const getDefaultDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 6);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return {
      start: formatDate(lastWeek),
      end: formatDate(today)
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showIntegratedModal, setShowIntegratedModal] = useState(false);
  const [showOverallModal, setShowOverallModal] = useState(false);

  const formatDateDisplay = (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const options = { month: 'short', day: '2-digit', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return dateStr;
    }
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  // --- Filter visits based on date range ---
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      try {
        if (!v?.checkInTime) return false;
        const checkInDate = v.checkInTime.toDate ? v.checkInTime.toDate() : new Date(v.checkInTime);
        if (isNaN(checkInDate.getTime())) return false;
        
        checkInDate.setHours(0, 0, 0, 0);
        
        const startDate = parseLocalDate(dateRange.start);
        const endDate = parseLocalDate(dateRange.end);
        if (!startDate || !endDate) return false;
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return checkInDate >= startDate && checkInDate <= endDate;
      } catch (error) {
        return false;
      }
    });
  }, [visits, dateRange]);

  // --- Filter feedbacks based on date range ---
  const filteredFeedbacks = useMemo(() => {
    if (!filteredVisits.length) return [];

    const visitIdSet = new Set(filteredVisits.map(v => v.id).filter(Boolean));
    const startDate = parseLocalDate(dateRange.start);
    const endDate = parseLocalDate(dateRange.end);
    if (!startDate || !endDate) return [];
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return feedbacks.filter(f => {
      if (!visitIdSet.has(f.visitId)) return false;
      if (!f?.createdAt) return false;
      const feedbackDate = f.createdAt.toDate ? f.createdAt.toDate() : new Date(f.createdAt);
      if (isNaN(feedbackDate.getTime())) return false;
      return feedbackDate >= startDate && feedbackDate <= endDate;
    });
  }, [feedbacks, filteredVisits, dateRange]);

  // Get visit details for each feedback with anonymous names
  const feedbacksWithVisitDetails = useMemo(() => {
    // Create a map of visit IDs to office names
    const visitOfficeMap = {};
    visits.forEach(v => {
      if (v?.id) visitOfficeMap[v.id] = v.office;
    });
    
    return filteredFeedbacks.map((feedback, index) => {
      const visit = visits.find(v => v?.id === feedback?.visitId);
      
      // Generate anonymous ID
      const anonymousId = `Anonymous${String(index + 1).padStart(3, '0')}`;
      
      return {
        ...feedback,
        visitorName: anonymousId,
        visitorOffice: visitOfficeMap[feedback.visitId] || visit?.office,
        visitorDate: visit?.checkInTime ? (visit.checkInTime.toDate ? visit.checkInTime.toDate() : new Date(visit.checkInTime)).toLocaleDateString() : '',
        comment: feedback?.suggestion || feedback?.answers?.join?.(' ') || 'No comment provided'
      };
    });
  }, [filteredFeedbacks, visits]);

  const trafficData = calculateTrafficByDay(filteredVisits);
  const satisfactionRates = calculateSatisfactionRates(filteredFeedbacks);

  // Calculate average satisfaction from feedbacks
  const avgSatisfaction = useMemo(() => {
    if (filteredFeedbacks.length === 0) return "0.0";
    const total = filteredFeedbacks.reduce((sum, f) => sum + (f.averageRating || 0), 0);
    return (total / filteredFeedbacks.length).toFixed(1);
  }, [filteredFeedbacks]);

  const currentOfficeRecord = useMemo(() => {
    if (!currentUser || offices.length === 0) return null;

    if (currentUser.id) {
      const byId = offices.find(o => o.id === currentUser.id);
      if (byId) return byId;
    }

    const userEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : "";
    if (userEmail) {
      const byEmail = offices.find(o => (o.email || "").toLowerCase().trim() === userEmail);
      if (byEmail) return byEmail;
    }

    const userOffice = currentUser.originalOffice || currentUser.office;
    if (userOffice) {
      const byOfficeName = offices.find(o => compareOfficeNames(o.name, userOffice));
      if (byOfficeName) return byOfficeName;
    }

    if (currentUser.type === "SuperAdmin") {
      return offices.find(o => o.role === "super") || null;
    }

    return null;
  }, [currentUser, offices]);

  const printOfficeName = useMemo(() => {
    const fallbackOfficeName = "Office of the College of Computing and Information Sciences";

    if (!currentUser) return fallbackOfficeName;

    return (
      currentOfficeRecord?.officialName ||
      currentOfficeRecord?.name ||
      currentUser.originalOffice ||
      currentUser.office ||
      fallbackOfficeName
    );
  }, [currentUser, currentOfficeRecord]);

  const topTrafficDay = useMemo(() => {
    if (!trafficData || trafficData.length === 0) return null;
    return trafficData.reduce((max, item) => (item.count > max.count ? item : max), trafficData[0]);
  }, [trafficData]);

  const topSatisfactionBand = useMemo(() => {
    if (!satisfactionRates || satisfactionRates.length === 0) return null;
    return satisfactionRates.reduce((max, item) => (item.pct > max.pct ? item : max), satisfactionRates[0]);
  }, [satisfactionRates]);

  const feedbacksWithComments = useMemo(() => {
    return feedbacksWithVisitDetails.filter(
      f => f.comment && f.comment.trim() !== '' && f.comment !== 'No comment provided'
    );
  }, [feedbacksWithVisitDetails]);

  const feedbackHighlights = useMemo(() => {
    return feedbacksWithComments.slice(0, 8);
  }, [feedbacksWithComments]);

  const printSummaryParagraphs = useMemo(() => {
    const officeLabel = currentUser && currentUser.type === "OfficeAdmin"
      ? `the ${currentUser.originalOffice || currentUser.office} office`
      : "all offices";
    const visits = filteredVisits.length;
    const feedbackCount = filteredFeedbacks.length;
    const avgSat = avgSatisfaction;
    const topDayText = topTrafficDay
      ? `${topTrafficDay.day} had the highest traffic with ${topTrafficDay.count} visit${topTrafficDay.count !== 1 ? 's' : ''}`
      : "no single peak traffic day was observed";
    const topBandText = topSatisfactionBand
      ? `${topSatisfactionBand.label.toLowerCase()} (${topSatisfactionBand.pct}%)`
      : "no satisfaction distribution is available yet";
    const commentsCount = feedbacksWithComments.length;

    const p1 = `For the period ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, ${officeLabel} recorded ${visits} visitor check-in${visits !== 1 ? 's' : ''} and received ${feedbackCount} feedback response${feedbackCount !== 1 ? 's' : ''}, including ${commentsCount} written comment${commentsCount !== 1 ? 's' : ''}. The average satisfaction rating for this period was ${avgSat} out of 5. ${topDayText}, and the most common satisfaction category was ${topBandText}.`;

    const p2 = feedbackCount > 0
      ? `Written feedback highlights are summarized from ${commentsCount} comment${commentsCount !== 1 ? 's' : ''} and reflect the most frequent themes observed during the reporting period.`
      : `No written feedback was submitted during this period, so qualitative insights are not available.`;

    return [p1, p2];
  }, [
    currentUser,
    filteredVisits,
    filteredFeedbacks,
    avgSatisfaction,
    topTrafficDay,
    topSatisfactionBand,
    feedbacksWithComments,
    dateRange
  ]);

  const recommendationsText = useMemo(() => {
    const avg = parseFloat(avgSatisfaction || "0");
    if (filteredVisits.length === 0) {
      return "No visits were recorded in this period. Consider promoting visitor check-ins and validating that the log process is active across all entry points.";
    }
    if (filteredFeedbacks.length === 0) {
      return "Encourage visitors to submit feedback to improve the quality of insights. Simple prompts and QR access points can increase response rates.";
    }
    if (avg >= 4.0) {
      return "Overall satisfaction is strong. Maintain service quality and continue monitoring peak traffic days to sustain performance.";
    }
    if (avg >= 3.0) {
      return "Satisfaction is moderate. Focus on recurring issues surfaced in comments and reinforce service consistency during peak traffic days.";
    }
    return "Satisfaction is below target. Prioritize immediate service improvements, review operational bottlenecks, and follow up on critical feedback.";
  }, [avgSatisfaction, filteredVisits.length, filteredFeedbacks.length]);

  const reportId = useMemo(() => {
    const start = (dateRange.start || "").replace(/-/g, "");
    const end = (dateRange.end || "").replace(/-/g, "");
    if (!start || !end) return "VA-REPORT";
    return `VA-${start}-${end}`;
  }, [dateRange]);

  const preparedOn = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  // --- Export Functions ---
  const exportToCSV = () => {
    try {
      const avgSat = avgSatisfaction;

      let csvContent = '';
      
      // Header
      csvContent += `VISITOR ANALYTICS REPORT\n`;
      csvContent += `Period: ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}\n`;
      if (currentUser && currentUser.type === "OfficeAdmin") {
        csvContent += `Office: ${currentUser.originalOffice || currentUser.office}\n`;
      }
      csvContent += `Total Visitors: ${filteredVisits.length}\n`;
      csvContent += `Total Feedbacks: ${filteredFeedbacks.length}\n`;
      csvContent += `Average Satisfaction: ${avgSat}/5\n\n`;
      
      // Visitor Traffic Data
      csvContent += 'VISITOR TRAFFIC BY DAY\n';
      csvContent += 'Day,Visitors Count,Relative Percentage\n';
      trafficData.forEach(item => {
        csvContent += `${item.day},${item.count},${item.value}%\n`;
      });
      
      csvContent += '\n';
      
      // Satisfaction Data
      csvContent += 'SATISFACTION RATES\n';
      csvContent += 'Category,Percentage,Count\n';
      satisfactionRates.forEach(rate => {
        const count = Math.round((rate.pct / 100) * filteredFeedbacks.length);
        csvContent += `${rate.label},${rate.pct}%,${count}\n`;
      });
      
      csvContent += '\n';
      
      // Feedback Details
      csvContent += 'DETAILED FEEDBACK ANALYSIS\n';
      csvContent += 'Date,Visitor ID,Office,Rating,Stars,Comments\n';
      
      feedbacksWithVisitDetails.forEach(f => {
        const ratingStars = '★'.repeat(Math.round(f.averageRating)) + '☆'.repeat(5 - Math.round(f.averageRating));
        const comment = (f.comment || '').replace(/"/g, '""');
        const dateStr = f.visitorDate || (f.createdAt ? (f.createdAt.toDate ? f.createdAt.toDate() : new Date(f.createdAt)).toLocaleDateString() : 'N/A');
        const anonymousName = f.visitorName;
        csvContent += `${dateStr},${anonymousName},${f.visitorOffice || 'N/A'},${f.averageRating.toFixed(1)}/5,${ratingStars},"${comment}"\n`;
      });

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      const fileName = currentUser && currentUser.type === "OfficeAdmin" 
        ? `${currentUser.originalOffice || currentUser.office}-analytics-${dateRange.start}-to-${dateRange.end}.csv`
        : `visitor-analytics-${dateRange.start}-to-${dateRange.end}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const exportToPDF = () => {
    try {
      window.print();
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
  };

  // Generate integrated narrative
  const generateIntegratedNarrative = () => {
    const avgSat = avgSatisfaction;
    
    let narrative = `During the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, `;
    
    if (currentUser && currentUser.type === "OfficeAdmin") {
      narrative += `the ${currentUser.originalOffice || currentUser.office} office `;
    } else {
      narrative += `our facility `;
    }
    
    narrative += `recorded ${filteredVisits.length} visitor check-in${filteredVisits.length !== 1 ? 's' : ''} with ${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''}. The average satisfaction rating was ${avgSat} out of 5. `;
    
    if (filteredFeedbacks.length > 0) {
      narrative += `The feedback received reveals valuable insights into visitor experiences${currentUser && currentUser.type === "OfficeAdmin" ? ' at this office' : ' across different offices'}. `;
      
      const highSat = filteredFeedbacks.filter(f => f.averageRating >= 4.0);
      const mediumSat = filteredFeedbacks.filter(f => f.averageRating >= 3.0 && f.averageRating < 4.0);
      const lowSat = filteredFeedbacks.filter(f => f.averageRating < 3.0);
      
      if (highSat.length > 0) {
        narrative += `${highSat.length} feedback${highSat.length !== 1 ? 's' : ''} expressed high satisfaction (4.0+), highlighting positive experiences. `;
      }
      
      if (mediumSat.length > 0) {
        narrative += `${mediumSat.length} provided neutral feedback (3.0-3.9), suggesting room for improvement. `;
      }
      
      if (lowSat.length > 0) {
        narrative += `${lowSat.length} indicated concerns with lower satisfaction scores (below 3.0), requiring attention. `;
      }
      
      narrative += `\n\nKey observations from feedback analysis:\n\n`;
      
      feedbacksWithVisitDetails.forEach((f, idx) => {
        if (f.comment && f.comment.trim() !== '' && f.comment !== 'No comment provided') {
          narrative += `${idx + 1}. ${f.visitorName}${currentUser && currentUser.type === "SuperAdmin" ? ` from ${f.visitorOffice || 'Unknown Office'}` : ''} rated their experience ${f.averageRating.toFixed(1)}/5: "${f.comment}"\n\n`;
        }
      });
    }
    
    return narrative;
  };

  // Generate overall analytics narrative
  const generateOverallNarrative = () => {
    let narrative = `# Executive Summary\n\nThis comprehensive analytics report covers the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, `;
    
    if (currentUser && currentUser.type === "OfficeAdmin") {
      narrative += `specifically for the ${currentUser.originalOffice || currentUser.office} office, `;
    }
    
    narrative += `providing insights into visitor traffic patterns, satisfaction rates, and feedback analysis.\n\n`;
    
    // Overview Section
    narrative += `## Overview\n\nDuring this reporting period, `;
    
    if (currentUser && currentUser.type === "OfficeAdmin") {
      narrative += `the ${currentUser.originalOffice || currentUser.office} office had `;
    } else {
      narrative += `our facility had `;
    }
    
    narrative += `${filteredVisits.length} visitor check-in${filteredVisits.length !== 1 ? 's' : ''} and received ${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''}, achieving an overall average satisfaction rating of ${avgSatisfaction} out of 5.0. This represents a ${parseFloat(avgSatisfaction) >= 4.0 ? 'strong' : parseFloat(avgSatisfaction) >= 3.0 ? 'moderate' : 'developing'} level of visitor satisfaction across all touchpoints.\n\n`;
    
    // Traffic Analysis
    narrative += `## Visitor Traffic Analysis\n\n`;
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const maxTrafficDay = trafficData.reduce((max, day) => day.count > max.count ? day : max, trafficData[0]);
    const minTrafficDay = trafficData.reduce((min, day) => day.count < min.count ? day : min, trafficData[0]);
    const totalVisits = trafficData.reduce((sum, day) => sum + day.count, 0);
    
    narrative += `Traffic distribution throughout the week shows varying patterns of visitor engagement. `;
    
    if (maxTrafficDay.count > 0) {
      const dayName = daysOfWeek[trafficData.indexOf(maxTrafficDay)];
      narrative += `${dayName} recorded the highest traffic with ${maxTrafficDay.count} visitor check-in${maxTrafficDay.count !== 1 ? 's' : ''}, `;
      
      if (minTrafficDay.count === 0) {
        const minDayName = daysOfWeek[trafficData.indexOf(minTrafficDay)];
        narrative += `while ${minDayName} saw no visitor activity. `;
      } else if (minTrafficDay.count < maxTrafficDay.count) {
        const minDayName = daysOfWeek[trafficData.indexOf(minTrafficDay)];
        narrative += `while ${minDayName} had the lowest with ${minTrafficDay.count} visitor check-in${minTrafficDay.count !== 1 ? 's' : ''}. `;
      }
    }
    
    const weekdayTotal = trafficData.slice(0, 5).reduce((sum, day) => sum + day.count, 0);
    const weekendTotal = trafficData.slice(5, 7).reduce((sum, day) => sum + day.count, 0);
    
    if (totalVisits > 0) {
      const weekdayPct = Math.round((weekdayTotal / totalVisits) * 100);
      const weekendPct = Math.round((weekendTotal / totalVisits) * 100);
      narrative += `Weekday visits accounted for ${weekdayPct}% of total traffic, with weekend visits comprising ${weekendPct}%.\n\n`;
    }
    
    // Satisfaction Analysis
    narrative += `## Satisfaction Rate Analysis\n\n`;
    
    const verySatisfied = satisfactionRates.find(r => r.label === 'Very Satisfied');
    const satisfied = satisfactionRates.find(r => r.label === 'Satisfied');
    const neutral = satisfactionRates.find(r => r.label === 'Neutral');
    const unsatisfied = satisfactionRates.find(r => r.label === 'Unsatisfied');
    const veryUnsatisfied = satisfactionRates.find(r => r.label === 'Very unsatisfied');
    
    const positivePct = (verySatisfied?.pct || 0) + (satisfied?.pct || 0);
    const negativePct = (unsatisfied?.pct || 0) + (veryUnsatisfied?.pct || 0);
    
    narrative += `Our satisfaction metrics reveal a comprehensive picture of visitor experiences. `;
    
    if (positivePct > 0) {
      narrative += `${positivePct}% of feedback expressed positive satisfaction (satisfied or very satisfied), `;
    }
    
    if (neutral?.pct > 0) {
      narrative += `${neutral.pct}% remained neutral, `;
    }
    
    if (negativePct > 0) {
      narrative += `and ${negativePct}% indicated dissatisfaction. `;
    }
    
    narrative += `\n\nBreaking down the satisfaction categories:\n`;
    satisfactionRates.forEach(rate => {
      if (rate.pct > 0) {
        const count = Math.round((rate.pct / 100) * filteredFeedbacks.length);
        narrative += `- ${rate.label}: ${rate.pct}% (${count} feedback${count !== 1 ? 's' : ''})\n`;
      }
    });
    
    narrative += `\n`;
    
    // Key Insights Section
    if (filteredFeedbacks.length > 0) {
      const feedbacksWithComments = feedbacksWithVisitDetails.filter(
        f => f.comment && f.comment.trim() !== '' && f.comment !== 'No comment provided'
      );
      
      narrative += `## Key Insights from Feedback\n\n`;
      
      const highSat = filteredFeedbacks.filter(f => f.averageRating >= 4.0);
      const lowSat = filteredFeedbacks.filter(f => f.averageRating < 3.0);
      
      if (highSat.length > 0) {
        const highestFeedback = highSat.sort((a, b) => b.averageRating - a.averageRating)[0];
        narrative += `**Positive Highlights:** ${highSat.length} feedback${highSat.length !== 1 ? 's' : ''} provided high satisfaction ratings (4.0+), representing ${Math.round((highSat.length / filteredFeedbacks.length) * 100)}% of all responses. `;
        if (feedbacksWithComments.length > 0) {
          const positiveComments = feedbacksWithComments.filter(f => f.averageRating >= 4.0);
          narrative += `${positiveComments.length} of these included detailed written comments praising their experience.\n\n`;
        }
      }
      
      if (lowSat.length > 0) {
        const lowestFeedback = lowSat.sort((a, b) => a.averageRating - b.averageRating)[0];
        narrative += `**Areas for Improvement:** ${lowSat.length} feedback${lowSat.length !== 1 ? 's' : ''} indicated lower satisfaction levels (below 3.0), representing ${Math.round((lowSat.length / filteredFeedbacks.length) * 100)}% of responses. `;
        if (feedbacksWithComments.length > 0) {
          const negativeComments = feedbacksWithComments.filter(f => f.averageRating < 3.0);
          narrative += `${negativeComments.length} included specific suggestions for improvement.\n\n`;
        }
      }
      
      if (feedbacksWithComments.length > 0) {
        narrative += `**Written Feedback Summary:** Out of ${filteredFeedbacks.length} total feedback submissions, ${feedbacksWithComments.length} included detailed written comments providing deeper insights into visitor experiences.\n\n`;
      }
    }
    
    // Recommendations
    narrative += `## Recommendations\n\n`;
    
    if (negativePct > 20) {
      narrative += `- **Priority Action Required:** With ${negativePct}% negative feedback, immediate attention should be given to addressing visitor concerns and improving service quality.\n`;
    }
    
    if (neutral?.pct > 25) {
      narrative += `- **Enhancement Opportunities:** The ${neutral.pct}% neutral feedback suggests opportunities to elevate the visitor experience from satisfactory to excellent.\n`;
    }
    
    if (maxTrafficDay.count > minTrafficDay.count * 2) {
      narrative += `- **Resource Optimization:** Consider adjusting staffing and resources to better accommodate the significant traffic variations between peak and off-peak days.\n`;
    }
    
    if (positivePct >= 70) {
      narrative += `- **Maintain Excellence:** With ${positivePct}% positive satisfaction, continue current best practices while addressing remaining improvement areas.\n`;
    }
    
    if (filteredVisits.length === 0) {
      narrative += `- **Promote Visitation:** With no recorded visits during this period, consider promoting facility access or reviewing visitor check-in procedures.\n`;
    }
    
    narrative += `\n## Conclusion\n\nThis reporting period demonstrates ${parseFloat(avgSatisfaction) >= 4.0 ? 'strong visitor engagement and satisfaction' : parseFloat(avgSatisfaction) >= 3.0 ? 'steady visitor engagement with room for enhancement' : 'developing visitor engagement requiring focused improvements'}. Continued monitoring of these metrics will ensure sustained quality of visitor experiences and inform strategic decisions for facility management.`;
    
    return narrative;
  };

  // Debug info for OfficeAdmin
  // const debugInfo = useMemo(() => {
  //   if (!currentUser || currentUser.type !== "OfficeAdmin") return null;
    
  //   const visitsWithOffice = visits.filter(v => v.office);
  //   const uniqueOffices = [...new Set(visitsWithOffice.map(v => v.office))];
  //   const userOffice = currentUser.originalOffice || currentUser.office;
    
  //   return {
  //     userOffice: userOffice,
  //     normalizedUserOffice: currentUser.office,
  //     visitsCount: visits.length,
  //     feedbacksCount: feedbacks.length,
  //     filteredVisitsCount: filteredVisits.length,
  //     filteredFeedbacksCount: filteredFeedbacks.length,
  //     uniqueOfficesFound: uniqueOffices,
  //     officeMatch: uniqueOffices.some(office => 
  //       compareOfficeNames(office, userOffice)
  //     )
  //   };
  // }, [currentUser, visits, feedbacks, filteredVisits, filteredFeedbacks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B46C1] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics data...</p>
          {currentUser && currentUser.type === "OfficeAdmin" && (
            <p className="text-sm text-gray-500 mt-2">
              Loading data for {currentUser.originalOffice || currentUser.office}...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-only-section, .print-only-section * {
            visibility: visible;
          }
          .print-only-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0.5in;
          }
          html, body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-page {
            font-family: "Times New Roman", Times, serif;
            color: #111;
          }
          .report-title {
            letter-spacing: 0.12em;
          }
          .report-section-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 6px;
          }
          .report-meta {
            font-size: 11px;
          }
          .report-box {
            border: 1px solid #000;
            padding: 8px;
          }
        }
      `}</style>
      
      <main className="flex flex-col print-section">
        {/* Print-Only Summary */}
        <div className="hidden print:block bg-white print-only-section">
          <div className="max-w-6xl mx-auto report-page">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-28 h-20 flex items-center justify-center">
                  <img
                    src={bisuLogo}
                    alt="BISU Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-[14px]">Republic of the Philippines</p>
                  <h1 className="text-lg font-bold">BOHOL ISLAND STATE UNIVERSITY</h1>
                  <p className="text-[14px]">Magsija, Balilihan 6342, Bohol, Philippines</p>
                  <p className="text-[14px]">{printOfficeName}</p>
                  <p className="text-[14px] italic">Balance | Integrity | Stewardship | Uprightness</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-22 h-26 flex items-center justify-center">
                  <img
                    src={bagongPilipinasLogo}
                    alt="Bagong Pilipinas Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="w-42 h-26 flex items-center justify-center">
                  <img
                    src={tuvISOLogo}
                    alt="ISO 9001:2015 Certification"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-sm font-bold uppercase report-title">Visitor Analytics Report</h2>
              <p className="text-xs text-gray-700">
                Reporting Period: {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
              </p>
            </div>
            <div className="border-b border-black mt-3"></div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 report-meta">
              <div><span className="font-bold">Report No.:</span> {reportId}</div>
              <div><span className="font-bold">Prepared On:</span> {preparedOn}</div>
              <div><span className="font-bold">Prepared By:</span> VisiTrak System</div>
              <div>
                <span className="font-bold">Office:</span>{" "}
                {currentUser && currentUser.type === "OfficeAdmin"
                  ? (currentUser.originalOffice || currentUser.office || "N/A")
                  : "All Offices"}
              </div>
            </div>
            <div className="border-b border-gray-300 mt-3"></div>

            <div className="mt-4">
              <h3 className="report-section-title">1. Executive Summary</h3>
              {printSummaryParagraphs.map((p, idx) => (
                <p key={idx} className="text-[12px] leading-relaxed text-gray-800 mb-3 text-justify">
                  {p}
                </p>
              ))}
            </div>

            <div className="mt-4">
              <h3 className="report-section-title">2. Key Figures</h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="report-box">
                  <span className="font-bold">Office:</span> {currentUser && currentUser.type === "OfficeAdmin"
                    ? (currentUser.originalOffice || currentUser.office || "N/A")
                    : "All Offices"}
                </div>
                <div className="report-box">
                  <span className="font-bold">Period:</span> {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
                </div>
                <div className="report-box">
                  <span className="font-bold">Total Visitors:</span> {filteredVisits.length}
                </div>
                <div className="report-box">
                  <span className="font-bold">Total Feedback Responses:</span> {filteredFeedbacks.length}
                </div>
                <div className="report-box">
                  <span className="font-bold">Avg Satisfaction:</span> {avgSatisfaction}/5.0
                </div>
                <div className="report-box">
                  <span className="font-bold">Top Traffic Day:</span> {topTrafficDay ? `${topTrafficDay.day} (${topTrafficDay.count})` : "N/A"}
                </div>
                <div className="report-box col-span-2">
                  <span className="font-bold">Top Satisfaction Band:</span> {topSatisfactionBand ? `${topSatisfactionBand.label} (${topSatisfactionBand.pct}%)` : "N/A"}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="report-section-title">3. Findings</h3>
              <p className="text-[12px] leading-relaxed text-gray-800 mb-3 text-justify">
                {topTrafficDay
                  ? `Visitor traffic concentrated most on ${topTrafficDay.day}, indicating peak activity on that day. `
                  : "Visitor traffic did not show a clear peak day for this period. "}
                {topSatisfactionBand
                  ? `The satisfaction distribution is led by the ${topSatisfactionBand.label.toLowerCase()} category at ${topSatisfactionBand.pct}%. `
                  : "Satisfaction distribution is not yet available due to insufficient feedback. "}
                {feedbacksWithComments.length > 0
                  ? `Qualitative feedback provides additional context to these results.`
                  : `No written feedback was captured to support qualitative analysis.`}
              </p>
            </div>

            <div className="mt-4">
              <h3 className="report-section-title">4. Recommendations</h3>
              <p className="text-[12px] leading-relaxed text-gray-800 text-justify">
                {recommendationsText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto dark:bg-gray-900 print:hidden">
          <div className="max-w-6xl mx-auto space-y-6">
            
            
            
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Analytics Overview</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Data insights and visitor patterns
                    {currentUser && currentUser.type === "OfficeAdmin" && (
                      <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {currentUser.originalOffice || currentUser.office} Office
                      </span>
                    )}
                    {currentUser && currentUser.type === "SuperAdmin" && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        Super Admin View
                      </span>
                    )}
                    <span className="hidden print:inline"> | {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}</span>
                  </p>
               </div>

               <div className="flex gap-3 items-center no-print">
                 <div className="relative">
                   <button 
                     onClick={() => setShowOverallModal(true)}
                     className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white rounded-lg shadow-lg hover:shadow-xl transition-all text-sm font-medium"
                   >
                     <BarChart2 size={18} />
                     <span>Overall Integration</span>
                   </button>
                 </div>

                 <div className="relative">
                   <button 
                     onClick={() => setShowExportMenu(!showExportMenu)}
                     className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow text-sm font-medium text-gray-700 hover:bg-gray-50"
                   >
                     <Download size={18} className="text-gray-600" />
                     <span>Export</span>
                     <ChevronDown size={16} className="text-gray-400" />
                   </button>

                   {showExportMenu && (
                     <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 min-w-[180px]">
                       <button
                         onClick={exportToCSV}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                       >
                         <FileText size={16} className="text-gray-600" />
                         <div>
                           <div className="text-sm font-medium text-gray-800">Export CSV</div>
                           <div className="text-xs text-gray-500">Download with charts (.csv)</div>
                         </div>
                       </button>
                       <button
                         onClick={exportToPDF}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                       >
                         <Printer size={16} className="text-gray-600" />
                         <div>
                           <div className="text-sm font-medium text-gray-800">Print Report</div>
                           <div className="text-xs text-gray-500">Print or save as PDF</div>
                         </div>
                       </button>
                     </div>
                   )}
                 </div>

                 <div className="relative">
                 <button 
                   onClick={() => setShowDatePicker(!showDatePicker)}
                   className="flex gap-3 items-center bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                 >
                   <Calendar size={18} className="text-gray-500" />
                   <span className="text-sm font-medium text-gray-700">
                     {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
                   </span>
                   <ChevronDown size={16} className="text-gray-400" />
                 </button>

                 {showDatePicker && (
                   <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[320px]">
                     <div className="space-y-3">
                       <div>
                         <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                         <input 
                           type="date" 
                           className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                           value={dateRange.start} 
                           onChange={e => setDateRange({...dateRange, start: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                         <input 
                           type="date" 
                           className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                           value={dateRange.end} 
                           onChange={e => setDateRange({...dateRange, end: e.target.value})}
                         />
                       </div>
                       <button 
                         onClick={() => setShowDatePicker(false)}
                         className="w-full bg-[#6B46C1] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[#5B34B8] transition-colors"
                       >
                         Apply
                       </button>
                     </div>
                   </div>
                 )}
               </div>
             </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="min-h-[350px]">
                <VisitorTrafficChart trafficData={trafficData} />
              </Card>
              <Card className="min-h-[350px]">
                <SatisfactionChart ratings={satisfactionRates} />
              </Card>
            </div>


            {/* Feedback Insights */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent no-print"></div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">Feedback Insights</h3>
                </div>
                
                <div className="relative no-print">
                  <button 
                    onClick={() => setShowIntegratedModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg shadow-purple-200"
                  >
                    <FileText size={16} />
                    <span>Integrate</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Insights */}
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar print:max-h-none print:overflow-visible">
                {feedbacksWithVisitDetails.length > 0 ? (
                  (() => {
                    // Filter feedbacks that have comments
                    const feedbacksWithComments = feedbacksWithVisitDetails.filter(
                      feedback => feedback.comment && 
                                 feedback.comment.trim() !== '' && 
                                 feedback.comment !== 'No comment provided'
                    );
                    
                    // Show message if no feedbacks have comments
                    if (feedbacksWithComments.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-600">No feedback with comments available</p>
                          <p className="text-sm text-gray-500 mt-1">Only feedback with written comments are displayed here</p>
                        </div>
                      );
                    }
                    
                    // Display feedbacks that have comments
                    return feedbacksWithComments.map((feedback) => (
                      <div key={feedback.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-gray-800 dark:text-white">
                              {feedback.visitorName} 
                              {currentUser && currentUser.type === "SuperAdmin" && (
                                <span className="text-gray-500 font-normal ml-2">
                                  ({feedback.visitorOffice || 'Unknown Office'})
                                </span>
                              )}
                            </h4>
                            <p className="text-gray-600 text-sm mt-1 dark:text-white">{feedback.comment}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`text-lg ${i < Math.round(feedback.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-white">
                              {typeof feedback.averageRating === 'number' 
                                ? feedback.averageRating.toFixed(1) 
                                : parseFloat(feedback.averageRating || 0).toFixed(1)}/5
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                          {feedback.visitorDate || (feedback.createdAt ? (feedback.createdAt.toDate ? feedback.createdAt.toDate() : new Date(feedback.createdAt)).toLocaleDateString() : 'N/A')} | 
                          Rating: {typeof feedback.averageRating === 'number' 
                                  ? feedback.averageRating.toFixed(1) 
                                  : parseFloat(feedback.averageRating || 0).toFixed(1)}/5
                        </p>
                      </div>
                    ));
                  })()
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600">No feedback available for this period</p>
                    <p className="text-sm text-gray-500 mt-1">Feedback will appear here once visitors submit their reviews</p>
                  </div>
                )}
              </div>
            </Card>

          </div>
        </div>

        {/* Integrated Insights Modal */}
        {showIntegratedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Integrated Visitor Insights</h2>
                    <p className="text-purple-100 text-sm">
                      {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)} | 
                      {filteredVisits.length} Total Visitors | {filteredFeedbacks.length} Feedbacks
                      {currentUser && currentUser.type === "OfficeAdmin" && ` | ${currentUser.originalOffice || currentUser.office} Office`}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowIntegratedModal(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose max-w-none">
                  {generateIntegratedNarrative().split('\n').map((paragraph, idx) => {
                    if (!paragraph.trim()) return null;
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-4 text-justify">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowIntegratedModal(false)}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg"
                  >
                    <Printer size={16} />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overall Analytics Integration Modal */}
        {showOverallModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#6B46C1] via-[#553C9A] to-[#6B46C1] text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                      <BarChart2 size={28} />
                      Overall Analytics Integration
                    </h2>
                    <p className="text-purple-100 text-sm">
                      Comprehensive Report | {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
                      {currentUser && currentUser.type === "OfficeAdmin" && ` | ${currentUser.originalOffice || currentUser.office} Office`}
                    </p>
                    <p className="text-purple-200 text-xs mt-1">
                      {filteredVisits.length} Total Visitors | {filteredFeedbacks.length} Feedbacks | Avg Satisfaction: {avgSatisfaction}/5.0
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowOverallModal(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose max-w-none">
                  {generateOverallNarrative().split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1 key={idx} className="text-3xl font-bold text-gray-900 mt-8 mb-4 first:mt-0">
                          {trimmed.substring(2)}
                        </h1>
                      );
                    }
                    
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2 key={idx} className="text-2xl font-bold text-gray-800 mt-6 mb-3 pb-2 border-b-2 border-gray-200">
                          {trimmed.substring(3)}
                        </h2>
                      );
                    }
                    
                    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                      return (
                        <p key={idx} className="font-bold text-gray-900 mb-2 mt-4">
                          {trimmed.replace(/\*\*/g, '')}
                        </p>
                      );
                    }
                    
                    if (trimmed.startsWith('- ')) {
                      return (
                        <li key={idx} className="text-gray-700 leading-relaxed mb-2 ml-6">
                          {trimmed.substring(2)}
                        </li>
                      );
                    }
                    
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-4 text-justify">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowOverallModal(false)}
                      className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                    >
                      <Download size={16} />
                      <span>Export Report</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analytics;
