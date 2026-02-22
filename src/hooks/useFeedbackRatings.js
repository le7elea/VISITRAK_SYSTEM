// hooks/useFeedbackRatings.js
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const readTextField = (value) => (typeof value === "string" ? value.trim() : "");

const useFeedbackRatings = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsub = null;

    const setupListener = async () => {
      try {
        // Create query to fetch feedbacks ordered by creation date (newest first)
        const q = query(
          collection(db, "feedbacks"), 
          orderBy("createdAt", "desc")
        );
        
        // Set up real-time listener
        unsub = onSnapshot(
          q, 
          async (snapshot) => {
            try {
              // Map through all documents and extract data with office from visits
              const dataPromises = snapshot.docs.map(async (feedbackDoc) => {
                const d = feedbackDoc.data() || {};
                let officeFromVisit = d.office || "";
                const rawAnswers = d.answers ?? d.questionRatings ?? d.ratings ?? [];
                const parsedAnswers = Array.isArray(rawAnswers)
                  ? rawAnswers
                  : rawAnswers && typeof rawAnswers === "object"
                    ? Object.entries(rawAnswers).map(([question, rating]) => ({ question, rating }))
                    : [];
                
                // If visitId exists, fetch office from visits collection
                if (d.visitId) {
                  try {
                    const visitRef = doc(db, "visits", d.visitId);
                    const visitSnap = await getDoc(visitRef);
                    
                    if (visitSnap.exists()) {
                      const visitData = visitSnap.data();
                      officeFromVisit = visitData.office || d.office || "";
                      console.log(`📍 Fetched office "${officeFromVisit}" for visitId: ${d.visitId}`);
                    } else {
                      console.warn(`⚠️ Visit document not found for visitId: ${d.visitId}`);
                    }
                  } catch (visitError) {
                    console.error(`❌ Error fetching visit for visitId ${d.visitId}:`, visitError);
                  }
                }
                
                return {
                  id: feedbackDoc.id || "",
                  visitId: d.visitId || "",
                  name: d.name || "",
                  email: d.email || "",
                  office: officeFromVisit,
                  visitPurpose: d.visitPurpose || "",
                  
                  // Feedback-specific fields
                  answers: parsedAnswers,
                  averageRating: typeof d.averageRating === 'number' ? d.averageRating : 0,
                  commendation: readTextField(d.commendation || d.commendations || d.positiveFeedback || d.compliment),
                  suggestion: readTextField(d.suggestion || d.recommendation),
                  questions: Array.isArray(d.questions) ? d.questions : [],
                  
                  // Timestamp - handle Firestore Timestamp objects
                  createdAt: d.createdAt || new Date(),
                  
                  // Store raw data for debugging if needed
                  _raw: d
                };
              });
              
              const data = await Promise.all(dataPromises);
              
              console.log(`✅ Loaded ${data.length} feedback records with office data`);
              setFeedbacks(data);
              setError(null);
              setLoading(false);
            } catch (parseError) {
              console.error("❌ Error parsing feedback data:", parseError);
              setError(new Error("Failed to parse feedback data. Please check the data format."));
              setLoading(false);
            }
          }, 
          (firebaseError) => {
            console.error("❌ Firebase error fetching feedbacks:", firebaseError);
            
            // Provide more specific error messages
            let errorMessage = "Failed to load feedback data.";
            
            if (firebaseError.code === 'permission-denied') {
              errorMessage = "Permission denied. Please check your Firebase security rules.";
            } else if (firebaseError.code === 'unavailable') {
              errorMessage = "Network error. Please check your internet connection.";
            } else if (firebaseError.message) {
              errorMessage = firebaseError.message;
            }
            
            setError(new Error(errorMessage));
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("❌ Error setting up feedbacks listener:", err);
        setError(new Error("Failed to initialize feedback listener."));
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      if (unsub) {
        unsub();
        console.log("🔌 Unsubscribed from feedbacks listener");
      }
    };
  }, []);

  return { feedbacks, loading, error };
};

export default useFeedbackRatings;
