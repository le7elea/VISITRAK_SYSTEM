import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const useAdminVisitors = (user = { type: "SuperAdmin", office: null }) => {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    const isOfficeAdmin = user?.type === "OfficeAdmin";
    const userOffice = String(user?.office || "").trim();
    const hasOffice = userOffice !== "";

    const q =
      isOfficeAdmin && hasOffice
        ? query(collection(db, "visits"), where("office", "==", userOffice))
        : query(collection(db, "visits"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          const checkInDate = d.checkInTime?.toDate() || null;
          const createdAtDate = d.createdAt?.toDate?.() || null;
          const sortDate = checkInDate || createdAtDate || new Date(0);

          return {
            id: doc.id,
            name: d.name,
            office: d.office,
            purpose: d.purpose,
            status: d.status === "checked-in" ? "Check In" : "Check Out",
            satisfaction: d.rating || 0,
            date: createdAtDate ? createdAtDate.toLocaleDateString() : "",
            checkInTime: checkInDate,
            checkInTimeFormatted: checkInDate
              ? checkInDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--",
            checkOutTime: d.checkOutTime?.toDate() || null,
            _sortTime: sortDate.getTime(),
          };
        });

        const sorted = data.sort((a, b) => (b._sortTime || 0) - (a._sortTime || 0));
        setVisitors(sorted);
      },
      (error) => {
        console.error("useAdminVisitors onSnapshot error:", error);
        setVisitors([]);
      }
    );

    return () => unsub();
  }, [user?.type, user?.office]);

  return { visitors };
};

export default useAdminVisitors;
