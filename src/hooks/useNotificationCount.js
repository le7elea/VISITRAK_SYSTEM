// hooks/useNotificationCount.js
import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

export const useNotificationCount = (user) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const setupListener = () => {
      try {
        const visitsRef = collection(db, "visits");
        
        let q = query(visitsRef, orderBy("checkInTime", "desc"));
        
        if (user.type === "OfficeAdmin" && user.office) {
          q = query(
            visitsRef,
            where("office", "==", user.office),
            orderBy("checkInTime", "desc")
          );
        }
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          let count = 0;
          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            
            let checkInDate = new Date();
            if (data.checkInTime instanceof Timestamp) {
              checkInDate = data.checkInTime.toDate();
            } else if (data.checkInTime && data.checkInTime.toDate) {
              checkInDate = data.checkInTime.toDate();
            } else if (data.checkInTime) {
              checkInDate = new Date(data.checkInTime);
            }
            
            if (checkInDate > twentyFourHoursAgo) {
              count++;
            }
          });
          
          const displayCount = count > 99 ? '99+' : count;
          setUnreadCount(displayCount);
          setLoading(false);
          
        }, (error) => {
          console.error("Error fetching notification count:", error);
          setLoading(false);
        });
        
      } catch (error) {
        console.error("Error setting up notification count listener:", error);
        setLoading(false);
      }
    };

    setupListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const resetCount = () => {
    setUnreadCount(0);
  };

  return { unreadCount, loading, resetCount };
};