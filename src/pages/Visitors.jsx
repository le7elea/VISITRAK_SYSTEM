import React, { useState, useMemo, useEffect } from "react";
import FilterBar from "../components/FilterBar";
import VisitorTable from "../components/VisitorTable";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

const Visitors = ({ user = { type: "SuperAdmin", office: null } }) => {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [dateFilter, setDateFilter] = useState("");
  const [visits, setVisits] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true); 

  // Fetch visits from Firestore
  useEffect(() => {
    const fetchVisits = () => {
      try {
        const q = query(collection(db, "visits"), orderBy("checkInTime", "desc"));
        
        const unsub = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const d = doc.data();
            const checkInTime = d.checkInTime?.toDate() || new Date();
            const checkOutTime = d.checkOutTime?.toDate() || null;
            
            return {
              id: doc.id,
              visitorId: d.visitorId,
              name: d.visitorName || d.name || "Unknown Visitor",
              email: d.email || "",
              phone: d.phone || "",
              office: d.office || "Unknown Office",
              purpose: d.purpose || "",
              checkInTime: checkInTime,
              checkOutTime: checkOutTime,
              status: d.status || (checkOutTime ? 'checked-out' : 'checked-in'),
              // Format for display
              date: checkInTime.toLocaleDateString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                year: 'numeric' 
              }),
              timeIn: checkInTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              }),
              timeOut: checkOutTime 
                ? checkOutTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                : "-",
              // For filtering by exact date
              rawDate: checkInTime
            };
          });
          
          setVisits(data);
        }, (error) => {
          console.error("Error fetching visits:", error);
        });

        return () => unsub();
      } catch (error) {
        console.error("Error setting up visits listener:", error);
      }
    };

    fetchVisits();
  }, []);

  // Fetch feedbacks from Firestore
  useEffect(() => {
    const fetchFeedbacks = () => {
      try {
        const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
        
        const unsub = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              visitId: d.visitId,
              averageRating: d.averageRating || 0,
              createdAt: d.createdAt?.toDate() || new Date(),
            };
          });
          
          setFeedbacks(data);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching feedbacks:", error);
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error("Error setting up feedbacks listener:", error);
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, []);

  // Combine visits with feedback ratings
  const visitsWithRatings = useMemo(() => {
    return visits.map(visit => {
      // Find feedback for this visit
      const feedback = feedbacks.find(f => f.visitId === visit.id);
      
      return {
        ...visit,
        satisfaction: feedback?.averageRating || 0, // 0 means no feedback
      };
    });
  }, [visits, feedbacks]);

  // Export to CSV function
  const exportCSV = () => {
    try {
      let csvContent = 'ID,Name,Email,Phone,Office,Purpose,Date,Time In,Time Out,Status,Satisfaction Rating\n';
      
      filteredVisitors.forEach(v => {
        const name = v.name.includes(',') ? `"${v.name}"` : v.name;
        const purpose = v.purpose && v.purpose.includes(',') ? `"${v.purpose}"` : v.purpose || "";
        const status = v.status === 'checked-out' ? 'Checked Out' : 'Checked In';
        
        csvContent += `${v.id},${name},${v.email},${v.phone},${v.office},${purpose},${v.date},${v.timeIn},${v.timeOut},${status},${v.satisfaction}/5\n`;
      });

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      const fileName = user.type === "OfficeAdmin" 
        ? `${user.office}-visitors-${new Date().toISOString().split('T')[0]}.csv`
        : `all-visitors-${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  // Export to PDF function
  const exportPDF = () => {
    try {
      window.print();
    } catch (error) {
      console.error('Error printing:', error);
      alert('Failed to print. Please try again.');
    }
  };

  // Render stars for satisfaction ratings
  const renderStars = (rating) => {
    const normalizedRating = Math.min(5, Math.max(0, Math.round(rating || 0)));
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < normalizedRating ? "text-yellow-400" : "text-gray-300"}>
            ★
          </span>
        ))}
      </div>
    );
  };

  // Get unique offices from visits for the filter dropdown
  const uniqueOffices = useMemo(() => {
    const offices = visitsWithRatings
      .map(v => v.office)
      .filter((office, index, self) => 
        office && office.trim() !== "" && self.indexOf(office) === index
      )
      .sort();
    
    return ["All Offices", ...offices];
  }, [visitsWithRatings]);

  // ✅ Step 1: Filter visits based on user office (if OfficeAdmin)
  const officeFiltered = useMemo(() => {
    if (user.type === "OfficeAdmin" && user.office) {
      return visitsWithRatings.filter((v) => v.office === user.office);
    }
    return visitsWithRatings;
  }, [visitsWithRatings, user]);

  // ✅ Step 2: Apply search, office dropdown (if SuperAdmin), and date filters
  const filteredVisitors = useMemo(() => {
    return officeFiltered.filter((v) => {
      const matchSearch = 
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.email && v.email.toLowerCase().includes(search.toLowerCase())) ||
        (v.phone && v.phone.includes(search));
      
      const matchOffice =
        user.type === "SuperAdmin"
          ? officeFilter === "All Offices" || v.office === officeFilter
          : true;
      
      let matchDate = true;
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);
        
        const visitorDate = v.rawDate || new Date();
        visitorDate.setHours(0, 0, 0, 0);
        
        matchDate = visitorDate.getTime() === filterDate.getTime();
      }

      return matchSearch && matchOffice && matchDate;
    });
  }, [officeFiltered, search, officeFilter, dateFilter, user.type]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredVisitors.length;
    const checkedIn = filteredVisitors.filter(v => v.status === 'checked-in').length;
    const checkedOut = filteredVisitors.filter(v => v.status === 'checked-out').length;
    
    const ratedVisitors = filteredVisitors.filter(v => v.satisfaction > 0);
    const avgSatisfaction = ratedVisitors.length > 0 
      ? (ratedVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / ratedVisitors.length).toFixed(1)
      : "0.0";
    
    return { total, checkedIn, checkedOut, avgSatisfaction };
  }, [filteredVisitors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7400EA] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading visitor records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 pt-2 pb-6 space-y-4 font-sans">
      {/* 🔍 Filters */}
      <FilterBar
        user={user}
        search={search}
        setSearch={setSearch}
        officeFilter={officeFilter}
        setOfficeFilter={setOfficeFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        exportCSV={exportCSV}
        exportPDF={exportPDF}
        uniqueOffices={uniqueOffices}
      />

      {/* 📋 Visitor Table - Using your existing VisitorTable component */}
      <VisitorTable visitors={filteredVisitors} renderStars={renderStars} />
    </div>
  );
};

export default Visitors;