// src/data/VisitorData.jsx
import { useState, useEffect } from "react";

export const useVisitorData = () => {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    // 🧩 Simulated API or local data with feedback comments
    const fetchedVisitors = [
      {
        id: 1,
        name: "Ethan Carlo",
        alias: "Anonymous001",
        office: "Registrar",
        date: "30/11/2025",
        timeIn: "11:11 AM",
        timeOut: "11:45 AM",
        status: "Checked Out",
        satisfaction: 4.0,
        comment: "Staff was very accommodating and helpful! The process was smooth. Thanks!",
      },
      {
        id: 2,
        name: "Oscar Doe",
        alias: "Anonymous002",
        office: "Admin Office",
        date: "03/11/2025",
        timeIn: "11:31 AM",
        timeOut: "",
        status: "Check In",
        satisfaction: 3.8,
        comment: "Queue was a bit long but the staff were nice.",
      },
      {
        id: 3,
        name: "Alice Gou",
        alias: "Anonymous003",
        office: "Extension Office",
        date: "02/11/2025",
        timeIn: "11:45 AM",
        timeOut: "12:10 PM", 
        status: "Checked Out",
        satisfaction: 4.9,
        comment: "Excellent service! Keep it up!",
      },
      {
        id: 4,
        name: "Cardo Dalisay",
        alias: "Anonymous004",
        office: "Clinic",
        date: "07/11/2025",
        timeIn: "12:05 PM",
        timeOut: "",
        status: "Check In",
        satisfaction: 4.6,
        comment: "Quick service and clean environment.",
      },
      {
        id: 5,
        name: "Marriaha Queen Arceta",
        alias: "Anonymous005",
        office: "Registrar",
        date: "02/11/2025",
        timeIn: "12:10 PM",
        timeOut: "12:50 PM",
        status: "Checked Out",
        satisfaction: 4.0,
        comment: "Good experience overall.",
      },
    ];

    setVisitors(fetchedVisitors);
  }, []);

  return { visitors, setVisitors };
};