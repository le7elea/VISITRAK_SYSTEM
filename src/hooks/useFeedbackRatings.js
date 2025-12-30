// hooks/useFeedbackRatings.js
import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

const useFeedbackRatings = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const q = query(collection(db, "feedbacks"));
      
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
            createdAt: d.createdAt?.toDate() || new Date(),
          };
        });
        
        setFeedbacks(data);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching feedbacks:", error);
        setError(error);
        setLoading(false);
      });

      return () => unsub();
    } catch (err) {
      console.error("Error setting up feedbacks listener:", err);
      setError(err);
      setLoading(false);
    }
  }, []);

  return { feedbacks, loading, error };
};

export default useFeedbackRatings;