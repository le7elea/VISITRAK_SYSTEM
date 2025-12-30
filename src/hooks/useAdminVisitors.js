import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const useAdminVisitors = () => {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "visits"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        const checkInDate = d.checkInTime?.toDate();

        return {
          id: doc.id,

          // Existing fields (UI EXPECTS THESE)
          name: d.name,
          office: d.office,
          purpose: d.purpose,
          status: d.status === "checked-in" ? "Check In" : "Check Out",
          satisfaction: d.rating || 0,

          // Date helpers
          date: d.createdAt
            ? d.createdAt.toDate().toLocaleDateString()
            : "",

          // ✅ CHECK-IN TIME (NEW)
          checkInTime: checkInDate || null,
          checkInTimeFormatted: checkInDate
            ? checkInDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--",

          // Optional if needed later
          checkOutTime: d.checkOutTime?.toDate() || null,
        };
      });

      setVisitors(data);
    });

    return () => unsub();
  }, []);

  return { visitors };
};

export default useAdminVisitors;
