// hooks/useFeedbackRatings.js
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const readTextField = (value) =>
  typeof value === "string" ? value.trim() : "";

const getNumericRating = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getReadableValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const candidate =
      value.value ??
      value.label ??
      value.name ??
      value.text ??
      value.selected ??
      value.type;

    if (candidate !== undefined && candidate !== null) {
      return getReadableValue(candidate);
    }
  }

  return "";
};

const findValueByKeyPattern = (obj, patterns = [], depth = 3) => {
  if (!obj || typeof obj !== "object" || depth < 0) return "";

  for (const [key, value] of Object.entries(obj)) {
    const matchesKey = patterns.some((pattern) => pattern.test(key));
    if (matchesKey) {
      const extracted = getReadableValue(value);
      if (extracted) return extracted;
    }

    if (value && typeof value === "object") {
      const nested = findValueByKeyPattern(value, patterns, depth - 1);
      if (nested) return nested;
    }
  }

  return "";
};

const getVisitSexValue = (visitData = {}) => {
  const directCandidates = [
    visitData.sex,
    visitData.gender,
    visitData.clientSex,
    visitData.client_gender,
    visitData.visitorSex,
    visitData.visitorGender,
    visitData.sexAtBirth,
    visitData.personalInfo?.sex,
    visitData.personalInfo?.gender,
    visitData.visitor?.sex,
    visitData.visitor?.gender,
    visitData.profile?.sex,
    visitData.profile?.gender,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return findValueByKeyPattern(
    visitData,
    [
      /^sex$/i,
      /^gender$/i,
      /visitor.*sex/i,
      /visitor.*gender/i,
      /client.*sex/i,
      /client.*gender/i,
    ],
    3,
  );
};

const getVisitClientTypeValue = (visitData = {}) => {
  const directCandidates = [
    visitData.clientType,
    visitData.client_type,
    visitData.clientClassification,
    visitData.customerType,
    visitData.customer_type,
    visitData.clientCategory,
    visitData.typeOfClient,
    visitData.clientClass,
    visitData.client,
    visitData.surveyDetails?.clientType,
    visitData.surveyDetails?.client_type,
    visitData.surveyDetails?.clientClassification,
    visitData.personalInfo?.clientType,
    visitData.visitor?.clientType,
    visitData.profile?.clientType,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return findValueByKeyPattern(
    visitData,
    [
      /client.*type/i,
      /customer.*type/i,
      /client.*classification/i,
      /classification/i,
      /client.*category/i,
      /type.*client/i,
    ],
    3,
  );
};

const getCharterRatingValue = (recordData = {}, questionNumber) => {
  if (!questionNumber) return null;

  const ccKey = `cc${questionNumber}`;
  const directCandidates = [
    recordData?.[ccKey],
    recordData?.[`${ccKey}Rating`],
    recordData?.[`citizensCharter${questionNumber}`],
    recordData?.[`charter${questionNumber}`],
    recordData?.citizensCharter?.[ccKey],
    recordData?.citizensCharter?.[`${questionNumber}`],
    recordData?.surveyDetails?.[ccKey],
    recordData?.surveyDetails?.[`${ccKey}Rating`],
    recordData?.surveyDetails?.citizensCharter?.[ccKey],
    recordData?.surveyDetails?.citizensCharter?.[`${questionNumber}`],
    recordData?.surveyDetails?.citizenCharter?.[ccKey],
    recordData?.surveyDetails?.citizenCharter?.[`${questionNumber}`],
  ];

  for (const candidate of directCandidates) {
    const numeric = getNumericRating(candidate);
    if (numeric !== null) return numeric;

    const readable = getReadableValue(candidate);
    const parsedReadable = getNumericRating(readable);
    if (parsedReadable !== null) return parsedReadable;
  }

  const fallback = findValueByKeyPattern(
    recordData,
    [
      new RegExp(`^cc[-_\\s]*${questionNumber}$`, "i"),
      new RegExp(`citizens?charter.*cc[-_\\s]*${questionNumber}`, "i"),
      new RegExp(`charter.*${questionNumber}$`, "i"),
    ],
    5,
  );

  const fallbackNumeric = getNumericRating(fallback);
  return fallbackNumeric !== null ? fallbackNumeric : null;
};

const getRegionOfResidenceValue = (recordData = {}) => {
  const directCandidates = [
    recordData.region,
    recordData.regionOfResidence,
    recordData.residenceRegion,
    recordData.regionResidence,
    recordData.address?.region,
    recordData.address?.province,
    recordData.personalInfo?.region,
    recordData.personalInfo?.province,
    recordData.visitor?.region,
    recordData.visitor?.province,
    recordData.profile?.region,
    recordData.profile?.province,
    recordData.location?.region,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return findValueByKeyPattern(
    recordData,
    [
      /region.*resid/i,
      /resid.*region/i,
      /region/i,
      /province/i,
      /address.*region/i,
      /address.*province/i,
    ],
    4,
  );
};

const getServiceAvailedValue = (recordData = {}) => {
  const directCandidates = [
    recordData.visitPurpose,
    recordData.purpose,
    recordData.reasonForVisit,
    recordData.reason,
    recordData.serviceAvailed,
    recordData.servicesAvailed,
    recordData.serviceRequested,
    recordData.servicesRequested,
    recordData.transactionType,
    recordData.transaction,
    recordData.service,
    recordData.services,
    recordData.surveyDetails?.purpose,
    recordData.surveyDetails?.serviceAvailed,
    recordData.surveyDetails?.servicesAvailed,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return findValueByKeyPattern(
    recordData,
    [
      /visit.*purpose/i,
      /reason.*visit/i,
      /service.*availed/i,
      /services.*availed/i,
      /service.*requested/i,
      /transaction.*type/i,
      /^service$/i,
    ],
    4,
  );
};

const getServicedByValue = (recordData = {}) => {
  const directCandidates = [
    recordData.servicedBy,
    recordData.servedBy,
    recordData.serviceBy,
    recordData.employeeName,
    recordData.staffName,
    recordData.personnelName,
    recordData.surveyDetails?.servicedBy,
    recordData.surveyDetails?.servedBy,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return findValueByKeyPattern(
    recordData,
    [
      /serviced.*by/i,
      /served.*by/i,
      /service.*by/i,
      /employee.*name/i,
      /staff.*name/i,
      /personnel.*name/i,
    ],
    4,
  );
};

const getOfficeValue = (feedbackData = {}, visitData = {}) => {
  const directCandidates = [
    feedbackData.office,
    feedbackData.unitOfficeVisited,
    feedbackData.officeVisited,
    feedbackData.unitOffice,
    visitData.office,
    visitData.unitOfficeVisited,
    visitData.officeVisited,
    visitData.unitOffice,
    visitData.surveyDetails?.office,
    visitData.surveyDetails?.unitOfficeVisited,
  ];

  for (const candidate of directCandidates) {
    const value = getReadableValue(candidate);
    if (value) return value;
  }

  return "";
};

const getVisitDateTimeValue = (feedbackData = {}, visitData = {}) =>
  visitData.checkInTime ||
  feedbackData.checkInTime ||
  feedbackData.visitDateTime ||
  feedbackData.createdAt ||
  null;

const useFeedbackRatings = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsub = null;

    const setupListener = async () => {
      try {
        const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));

        unsub = onSnapshot(
          q,
          async (snapshot) => {
            try {
              const dataPromises = snapshot.docs.map(async (feedbackDoc) => {
                const d = feedbackDoc.data() || {};
                let visitData = null;

                if (d.visitId) {
                  try {
                    const visitRef = doc(db, "visits", d.visitId);
                    const visitSnap = await getDoc(visitRef);

                    if (visitSnap.exists()) {
                      visitData = visitSnap.data() || {};
                    }
                  } catch (visitError) {
                    const visitErrorCode = String(visitError?.code || "");
                    if (visitErrorCode !== "permission-denied") {
                      console.error(
                        `Error fetching visit for visitId ${d.visitId}:`,
                        visitError,
                      );
                    }
                  }
                }

                const rawAnswers = d.answers ?? d.questionRatings ?? d.ratings ?? [];
                const parsedAnswers = Array.isArray(rawAnswers)
                  ? rawAnswers
                  : rawAnswers && typeof rawAnswers === "object"
                    ? Object.entries(rawAnswers).map(([question, rating]) => ({
                        question,
                        rating,
                      }))
                    : [];

                const officeValue = getOfficeValue(d, visitData || {});
                const serviceAvailed =
                  getServiceAvailedValue(d) || getServiceAvailedValue(visitData || {});

                return {
                  id: feedbackDoc.id || "",
                  visitId: d.visitId || "",
                  name: d.name || "",
                  displayName:
                    typeof d.displayName === "boolean"
                      ? d.displayName
                      : readTextField(d.displayName),
                  email: d.email || "",
                  office: officeValue,
                  unitOfficeVisited:
                    readTextField(d.unitOfficeVisited) ||
                    readTextField(visitData?.unitOfficeVisited) ||
                    officeValue,
                  visitPurpose: serviceAvailed,
                  answers: parsedAnswers,
                  averageRating: getNumericRating(d.averageRating) ?? 0,
                  commendation: readTextField(
                    d.commendation ||
                      d.commendations ||
                      d.positiveFeedback ||
                      d.compliment,
                  ),
                  suggestion: readTextField(d.suggestion || d.recommendation),
                  questions: Array.isArray(d.questions) ? d.questions : [],
                  createdAt: d.createdAt || new Date(),
                  visitDateTime: getVisitDateTimeValue(d, visitData || {}),
                  sex: getVisitSexValue(d) || getVisitSexValue(visitData || {}),
                  clientType:
                    getVisitClientTypeValue(d) ||
                    getVisitClientTypeValue(visitData || {}),
                  regionOfResidence:
                    getRegionOfResidenceValue(d) ||
                    getRegionOfResidenceValue(visitData || {}),
                  serviceAvailed,
                  servicedBy:
                    getServicedByValue(d) || getServicedByValue(visitData || {}),
                  cc1Rating:
                    getCharterRatingValue(d, 1) ??
                    getCharterRatingValue(visitData || {}, 1),
                  cc2Rating:
                    getCharterRatingValue(d, 2) ??
                    getCharterRatingValue(visitData || {}, 2),
                  cc3Rating:
                    getCharterRatingValue(d, 3) ??
                    getCharterRatingValue(visitData || {}, 3),
                  _raw: d,
                  _visit: visitData,
                };
              });

              const data = await Promise.all(dataPromises);

              setFeedbacks(data);
              setError(null);
              setLoading(false);
            } catch (parseError) {
              console.error("Error parsing feedback data:", parseError);
              setError(
                new Error(
                  "Failed to parse feedback data. Please check the data format.",
                ),
              );
              setLoading(false);
            }
          },
          (firebaseError) => {
            console.error("Firebase error fetching feedbacks:", firebaseError);

            let errorMessage = "Failed to load feedback data.";

            if (firebaseError.code === "permission-denied") {
              errorMessage =
                "Permission denied. Please check your Firebase security rules.";
            } else if (firebaseError.code === "unavailable") {
              errorMessage = "Network error. Please check your internet connection.";
            } else if (firebaseError.message) {
              errorMessage = firebaseError.message;
            }

            setError(new Error(errorMessage));
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("Error setting up feedbacks listener:", err);
        setError(new Error("Failed to initialize feedback listener."));
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, []);

  return { feedbacks, loading, error };
};

export default useFeedbackRatings;
