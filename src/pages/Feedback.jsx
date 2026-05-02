import React, { useState, useMemo, useEffect } from "react";
import { Clipboard, Download, FileText, Printer, QrCode, X } from "lucide-react";
import useFeedbackRatings from "../hooks/useFeedbackRatings";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import FeedbackModal from "../components/FeedbackModal";
import FilterBar from "../components/FilterBars";
import FeedbackTable from "../components/FeedbackTable";
import bisuLogo from "../assets/bisulogo.png";
import bagongPilipinasLogo from "../assets/bagong_pilipinas_logo.png";
import tuvISOLogo from "../assets/tuvISO_logo.png";

const toTrimmedText = (value) => (typeof value === "string" ? value.trim() : "");

const getAnonymousAlias = (index) =>
  `Anonymous${String(index + 1).padStart(3, "0")}`;

const getFeedbackDisplayName = (feedback, index) => {
  if (!feedback || typeof feedback !== "object") {
    return getAnonymousAlias(index);
  }

  if (typeof feedback.displayName === "boolean") {
    if (feedback.displayName) {
      return "Anonymous";
    }

    return toTrimmedText(feedback.name) || getAnonymousAlias(index);
  }

  const storedDisplayName = toTrimmedText(feedback.displayName);
  if (!storedDisplayName) {
    return getAnonymousAlias(index);
  }

  const normalizedDisplayName = storedDisplayName.toLowerCase();
  if (normalizedDisplayName === "anonymous" || normalizedDisplayName === "anon") {
    return "Anonymous";
  }

  if (
    normalizedDisplayName === "name" ||
    normalizedDisplayName === "show name" ||
    normalizedDisplayName === "display name"
  ) {
    return toTrimmedText(feedback.name) || getAnonymousAlias(index);
  }

  return storedDisplayName;
};

const getNumericRating = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeQuestionRatings = (answers, questions = []) => {
  if (!answers) return [];

  if (Array.isArray(answers)) {
    return answers.map((answer, index) => {
      const fallbackQuestion = toTrimmedText(questions[index]) || `Question ${index + 1}`;

      if (answer && typeof answer === "object") {
        const question = toTrimmedText(
          answer.question ||
            answer.label ||
            answer.text ||
            answer.title ||
            answer.prompt ||
            answer.item
        );

        const rating = getNumericRating(
          answer.rating ??
            answer.score ??
            answer.value ??
            answer.answer ??
            answer.selected
        );

        return {
          question: question || fallbackQuestion,
          rating,
        };
      }

      return {
        question: fallbackQuestion,
        rating: getNumericRating(answer),
      };
    });
  }

  if (typeof answers === "object") {
    return Object.entries(answers).map(([question, rating], index) => ({
      question: toTrimmedText(question) || `Question ${index + 1}`,
      rating: getNumericRating(rating),
    }));
  }

  return [];
};

const getValidSatisfactionRating = (value) => {
  const numeric = getNumericRating(value);

  if (numeric === null) return null;
  if (numeric <= 0 || numeric > 5) return null;

  return numeric;
};

const getAverageQuestionRating = (questionRatings = []) => {
  if (!Array.isArray(questionRatings)) return null;

  const numericRatings = questionRatings
    .map((item) => getValidSatisfactionRating(item?.rating))
    .filter((rating) => rating !== null);

  if (numericRatings.length === 0) return null;

  const total = numericRatings.reduce((sum, rating) => sum + rating, 0);
  return total / numericRatings.length;
};

const getFeedbackSatisfaction = (feedback, questionRatings = []) => {
  const rawAverageRating = getValidSatisfactionRating(feedback?._raw?.averageRating);
  if (rawAverageRating !== null) {
    return rawAverageRating;
  }

  const normalizedAverageRating = getValidSatisfactionRating(feedback?.averageRating);
  if (normalizedAverageRating !== null) {
    return normalizedAverageRating;
  }

  return getAverageQuestionRating(questionRatings);
};

const toLocalDateInput = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatPrintFooterDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

const getOfficialOfficeName = (officeValue, offices = []) => {
  const normalizedOffice = toTrimmedText(officeValue).toLowerCase();
  if (!normalizedOffice) return "";

  const matchedOffice = offices.find((officeItem) => {
    const officeName = toTrimmedText(officeItem?.name).toLowerCase();
    const officialName = toTrimmedText(officeItem?.officialName).toLowerCase();

    return normalizedOffice === officeName || normalizedOffice === officialName;
  });

  return (
    toTrimmedText(matchedOffice?.officialName) || toTrimmedText(officeValue)
  );
};

const compareOfficeNames = (leftOffice, rightOffice, offices = []) => {
  const leftOfficial = getOfficialOfficeName(leftOffice, offices) || leftOffice;
  const rightOfficial = getOfficialOfficeName(rightOffice, offices) || rightOffice;

  return (
    toTrimmedText(leftOfficial).toLowerCase() ===
    toTrimmedText(rightOfficial).toLowerCase()
  );
};

const escapeCSVValue = (value) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const generateFeedbackToken = () => {
  const randomBytes = new Uint8Array(16);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

const MANUAL_FEEDBACK_BASE_URL =
  import.meta.env.VITE_VISITRAK_WEB_URL || "https://visitrak-web.vercel.app";

const buildManualFeedbackUrl = ({ token, accessKey, officeName = "" }) => {
  const url = new URL("/satisfaction", MANUAL_FEEDBACK_BASE_URL);
  url.searchParams.set("mode", "manual");
  url.searchParams.set("token", token);
  url.searchParams.set("k", accessKey);

  const trimmedOffice = toTrimmedText(officeName);
  if (trimmedOffice) {
    url.searchParams.set("office", trimmedOffice);
  }

  return url.toString();
};

const getUserIdentifier = (user) =>
  user?.email || user?.username || user?.name || user?.uid || "Unknown user";

const buildQrImageUrl = (value) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(
    value
  )}`;

const Feedback = ({ user }) => {
  const [search, setSearch] = useState("");
  const [dayRange, setDayRange] = useState({ start: "", end: "" });
  const [office, setOffice] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [offices, setOffices] = useState([]);
  const [showPrintSignatoryModal, setShowPrintSignatoryModal] = useState(false);
  const [printSignatories, setPrintSignatories] = useState({
    prepared: "MA. MAELITH L. BUCHAN",
    verified: "HORONORIO O. UEHARA",
    approved: "MARRIETA C. MACALOLOT, PhD",
  });
  const [printFooterFields, setPrintFooterFields] = useState({
    documentCode: "F-AQA-CSF-002",
    revisionNumber: "Rev. 3",
  });
  const [printFooterSnapshot, setPrintFooterSnapshot] = useState({
    printedDate: formatPrintFooterDate(new Date()),
  });
  const [manualQrSettingsOpen, setManualQrSettingsOpen] = useState(false);
  const [manualQrSettings, setManualQrSettings] = useState({
    mode: "single",
    expiresInHours: 24,
    maxUses: 1,
  });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [generatedQr, setGeneratedQr] = useState(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const isOfficeAdmin = user?.type === "OfficeAdmin" || user?.role === "OfficeAdmin";
  
  // Use the custom hook to fetch feedbacks
  const { feedbacks, loading, error } = useFeedbackRatings();

  // ✅ FIX: Set office to user's office if they're an Office Admin
  useEffect(() => {
    if (isOfficeAdmin && user?.office) {
      setOffice(user.office);
    }
  }, [isOfficeAdmin, user?.office]);

  const handlePrintSignatoryChange = (role, value) => {
    setPrintSignatories((previous) => ({
      ...previous,
      [role]: value,
    }));
  };

  const handlePrintFooterFieldChange = (field, value) => {
    setPrintFooterFields((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  useEffect(() => {
    const syncPrintedDate = () => {
      setPrintFooterSnapshot({
        printedDate: formatPrintFooterDate(new Date()),
      });
    };

    window.addEventListener("beforeprint", syncPrintedDate);

    return () => {
      window.removeEventListener("beforeprint", syncPrintedDate);
    };
  }, []);

  // Fetch offices from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "offices"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name || "",
            officialName: d.officialName || "",
          };
        });

        setOffices(data);
      },
      (error) => {
        console.error("Error fetching offices:", error);
      }
    );

    return () => {
      unsub();
    };
  }, []);
 
  // Get a safe date string from createdAt
  const getSafeDateString = (createdAt) => {
    if (!createdAt) return "";
    
    try {
      // Handle both Date objects and Firestore Timestamps
      if (createdAt.toDate) {
        return toLocalDateInput(createdAt.toDate());
      } else if (createdAt instanceof Date) {
        return toLocalDateInput(createdAt);
      } else if (typeof createdAt === "string" || typeof createdAt === "number") {
        return toLocalDateInput(new Date(createdAt));
      }
    } catch (err) {
      console.error("Error parsing date:", err);
    }
    
    return "";
  };

  // Get formatted display date
  const getDisplayDate = (createdAt) => {
    if (!createdAt) return "Date not available";
    
    try {
      let dateObj;
      
      if (createdAt.toDate) {
        dateObj = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        dateObj = createdAt;
      } else if (typeof createdAt === "string" || typeof createdAt === "number") {
        dateObj = new Date(createdAt);
      }

      if (!dateObj || Number.isNaN(dateObj.getTime())) {
        return "Date not available";
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Invalid date";
    }
  };

  // Combined filter logic with safe data access
  const filteredFeedbacks = useMemo(() => {
    if (!Array.isArray(feedbacks)) {
      return [];
    }
    
    try {
      return feedbacks
        .map((f, idx) => {
          const suggestion = toTrimmedText(f?.suggestion);
          const commendation = toTrimmedText(f?.commendation);
          const questionRatings = normalizeQuestionRatings(f?.answers, f?.questions);
          const displayName = getFeedbackDisplayName(f, idx);
          const satisfaction = getFeedbackSatisfaction(f, questionRatings);

          return {
            f,
            idx,
            suggestion,
            commendation,
            questionRatings,
            displayName,
            satisfaction,
          };
        })
        .filter(({ f, suggestion, commendation, displayName, satisfaction }) => {
          if (!f) return false;
          
          const hasWrittenFeedback = Boolean(commendation || suggestion);
          const hasDisplayableFeedback = hasWrittenFeedback || satisfaction !== null;
          if (!hasDisplayableFeedback) return false;
          
          const feedbackOffice = f.office || "Unspecified";
          const searchLower = (search || "").toLowerCase();
          
          // Safe search across multiple fields
          const nameMatch = displayName.toLowerCase().includes(searchLower);
          const suggestionMatch = suggestion.toLowerCase().includes(searchLower);
          const commendationMatch = commendation.toLowerCase().includes(searchLower);
          const visitIdMatch = (f.visitId || "").toLowerCase().includes(searchLower);
          const matchesSearch = nameMatch || suggestionMatch || commendationMatch || visitIdMatch;
          
          // Handle date range filter safely
          const dayString = getSafeDateString(f.createdAt);
          const matchesDate = (() => {
            if (!dayRange.start && !dayRange.end) return true;
            if (!dayString) return false;
            if (dayRange.start && dayString < dayRange.start) return false;
            if (dayRange.end && dayString > dayRange.end) return false;
            return true;
          })();
          
          // Handle office filter based on user role
          let matchesOffice = true;
          if (isOfficeAdmin) {
            matchesOffice = compareOfficeNames(
              feedbackOffice,
              user.office || "",
              offices,
            );
          } else if (office) {
            matchesOffice = compareOfficeNames(feedbackOffice, office, offices);
          }
          
          return matchesSearch && matchesDate && matchesOffice;
        })
        .map(({ f, idx, suggestion, commendation, questionRatings, displayName, satisfaction }) => {
          const feedbackOffice = f.office || "Unspecified";
          const officialOfficeName =
            getOfficialOfficeName(feedbackOffice, offices) || feedbackOffice;
          const formattedDate = getDisplayDate(f.createdAt);
          const previewComment =
            suggestion ||
            commendation ||
            "No written feedback provided. Rating details are available.";
          
          return {
            // Data for FeedbackTable
            id: f.id || `feedback-${idx}`,
            alias: getAnonymousAlias(idx),
            displayName,
            office: feedbackOffice,
            officialOfficeName,
            comment: previewComment,
            date: formattedDate,
            satisfaction,
            commendation: commendation || "No commendation provided.",
            suggestion: suggestion || "No suggestion provided.",
            questionRatings,
            
            // Additional data for FeedbackModal
            name: f.name || "",
            answers: f.answers || [],
            createdAt: f.createdAt || new Date(),
            visitDateTime: f.visitDateTime || f.createdAt || null,
            visitId: f.visitId || "",
            sex: f.sex || "",
            clientType: f.clientType || "",
            regionOfResidence: f.regionOfResidence || "",
            serviceAvailed: f.serviceAvailed || f.visitPurpose || "",
            servicedBy: f.servicedBy || "",
            cc1Rating: f.cc1Rating ?? null,
            cc2Rating: f.cc2Rating ?? null,
            cc3Rating: f.cc3Rating ?? null,
            
            // Store original for reference
            originalData: f,
          };
        });
    } catch (err) {
      console.error("Error filtering feedbacks:", err);
      return [];
    }
  }, [feedbacks, search, dayRange, office, isOfficeAdmin, user?.office, offices]);

  // Generate unique office options
  const officeOptions = useMemo(() => {
    try {
      const officeNames = (offices || [])
        .map((officeItem) => toTrimmedText(officeItem?.name))
        .filter(Boolean);

      const feedbackOfficeNames = Array.isArray(feedbacks)
        ? feedbacks
            .map((feedback) => toTrimmedText(feedback?.office))
            .filter(Boolean)
        : [];

      const combined = [...officeNames, ...feedbackOfficeNames];
      if (isOfficeAdmin && user?.office) {
        combined.push(user.office);
      }

      const uniqueOffices = [...new Set(combined)].sort();
      if (uniqueOffices.length > 0) {
        return uniqueOffices;
      }

      return ["Main Office", "Branch Office", "Headquarters"];
    } catch (err) {
      console.error("Error generating office options:", err);
      return ["Main Office", "Branch Office", "Headquarters"];
    }
  }, [offices, feedbacks, isOfficeAdmin, user?.office]);

  const exportCSV = () => {
    try {
      if (filteredFeedbacks.length === 0) {
        alert("No data to export!");
        return;
      }

      // Prepare CSV content
      const headers = [
        "Display Name",
        "Date",
        "Office",
        "Rating",
        "Commendation",
        "Suggestion",
      ];
      const csvRows = filteredFeedbacks.map(f => [
        escapeCSVValue(f.displayName || f.alias || "Anonymous"),
        escapeCSVValue(f.date),
        escapeCSVValue(f.office || "Unspecified"),
        escapeCSVValue(f.satisfaction),
        escapeCSVValue(f.commendation || ""),
        escapeCSVValue(f.suggestion || ""),
      ]);
      
      const csvContent = [
        headers.join(","),
        ...csvRows.map(row => row.join(","))
      ].join("\n");
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedbacks_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const exportPDF = () => {
    setShowPrintSignatoryModal(true);
  };

  const openManualQrSettings = () => {
    setManualQrSettings({
      mode: "single",
      expiresInHours: 24,
      maxUses: 1,
    });
    setManualQrSettingsOpen(true);
  };

  const handleGenerateQRCode = async () => {
    const token = generateFeedbackToken();
    const accessKey = generateFeedbackToken();
    const targetOffice = isOfficeAdmin ? user?.office : office;
    const approvedOffice = toTrimmedText(targetOffice) || "All Offices";
    const officialOfficeName =
      getOfficialOfficeName(approvedOffice, offices) || approvedOffice;
    const expiresInHours = Math.max(
      1,
      Math.min(168, Number(manualQrSettings.expiresInHours) || 24)
    );
    const maxUses =
      manualQrSettings.mode === "batch"
        ? Math.max(1, Math.min(500, Number(manualQrSettings.maxUses) || 25))
        : 1;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const feedbackUrl = buildManualFeedbackUrl({
      token,
      accessKey,
      officeName: approvedOffice,
    });
    const approvedBy = {
      id: user?.id || user?.uid || "",
      name: user?.name || user?.displayName || user?.username || "",
      email: user?.email || "",
      role: user?.type || user?.role || "",
    };

    setIsGeneratingQr(true);

    try {
      const docRef = await addDoc(collection(db, "manualFeedbackTokens"), {
        token,
        accessKey,
        url: feedbackUrl,
        mode: "manual",
        type: manualQrSettings.mode,
        source: "manual-qr",
        office: approvedOffice,
        officialOfficeName,
        approvedBy,
        approvedByLabel: getUserIdentifier(user),
        createdAt: serverTimestamp(),
        createdAtClient: new Date(),
        expiresAt,
        maxUses,
        remainingUses: maxUses,
        useCount: 0,
        used: false,
        status: "active",
        revoked: false,
        manualSubmissionDefaults: {
          manualEntry: true,
          source: "manual-qr",
          name: "Anonymous",
          visitName: "",
          visitId: "",
          office: approvedOffice,
          officialOfficeName,
        },
      });

      setGeneratedQr({
        id: docRef.id,
        token,
        accessKey,
        url: feedbackUrl,
        type: manualQrSettings.mode,
        office: approvedOffice,
        officialOfficeName,
        expiresAt,
        maxUses,
      });
      setManualQrSettingsOpen(false);
      setQrModalOpen(true);
    } catch (err) {
      console.error("Error generating manual feedback QR token:", err);
      const errorDetail = err?.code || err?.message || "Unknown error";
      alert(`Failed to generate manual feedback QR code: ${errorDetail}`);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const copyGeneratedUrl = async () => {
    if (!generatedQr?.url) return;

    try {
      await navigator.clipboard.writeText(generatedQr.url);
      alert("Manual feedback QR link copied.");
    } catch (err) {
      console.error("Error copying QR link:", err);
      alert("Could not copy the link. Please copy it manually.");
    }
  };

  const printGeneratedQr = () => {
    if (!generatedQr) return;

    const printWindow = window.open("", "_blank", "width=480,height=640");
    if (!printWindow) {
      alert("Please allow pop-ups so the QR code can be printed.");
      return;
    }

    const approvalUseLabel =
      generatedQr.type === "batch"
        ? `${generatedQr.maxUses} uses`
        : "Single-use";

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Manual Feedback QR Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 32px;
              color: #111827;
              text-align: center;
            }
            .qr-card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 24px;
            }
            h1 {
              font-size: 20px;
              margin: 0 0 8px;
            }
            p {
              margin: 6px 0;
              font-size: 13px;
              color: #374151;
            }
            img {
              width: 280px;
              height: 280px;
              margin: 18px auto;
              display: block;
            }
            .token {
              font-family: Consolas, monospace;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <h1>Manual Feedback Approval QR</h1>
            <p>${escapeHtml(generatedQr.officialOfficeName || generatedQr.office)}</p>
            <img src="${buildQrImageUrl(generatedQr.url)}" alt="Feedback QR Code" />
            <p class="token">Token: ${escapeHtml(generatedQr.token)}</p>
            <p>${escapeHtml(approvalUseLabel)}</p>
            <p>Expires: ${generatedQr.expiresAt.toLocaleString()}</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleConfirmPrint = () => {
    setShowPrintSignatoryModal(false);

    try {
      setPrintFooterSnapshot({
        printedDate: formatPrintFooterDate(new Date()),
      });

      setTimeout(() => {
        window.print();
      }, 0);
    } catch (error) {
      console.error("Error printing:", error);
      alert("Failed to print. Please try again.");
    }
  };

  // Handle view full action
  const handleViewFull = (visitor) => {
    try {
      if (!visitor) return;
      
      const modalData = {
        id: visitor.id || "",
        displayName: visitor.displayName || visitor.alias || "Anonymous",
        alias: visitor.alias || "",
        name: visitor.name || "Anonymous",
        office: visitor.office || "Unspecified",
        officialOfficeName:
          visitor.officialOfficeName ||
          getOfficialOfficeName(visitor.office, offices) ||
          visitor.office ||
          "Unspecified",
        date: visitor.date || "Date not available",
        comment: visitor.comment || "No feedback provided.",
        commendation: visitor.commendation || "No commendation provided.",
        suggestion: visitor.suggestion || "No suggestion provided.",
        satisfaction: visitor.satisfaction ?? null,
        answers: visitor.answers || [],
        questionRatings: visitor.questionRatings || [],
        createdAt: visitor.createdAt || new Date(),
        visitDateTime: visitor.visitDateTime || visitor.createdAt || null,
        visitId: visitor.visitId || "",
        sex: visitor.sex || "",
        clientType: visitor.clientType || "",
        regionOfResidence: visitor.regionOfResidence || "",
        serviceAvailed: visitor.serviceAvailed || "",
        servicedBy: visitor.servicedBy || "",
        cc1Rating: visitor.cc1Rating ?? null,
        cc2Rating: visitor.cc2Rating ?? null,
        cc3Rating: visitor.cc3Rating ?? null,
      };
      setSelectedVisitor(modalData);
    } catch (err) {
      console.error("Error opening modal:", err);
      alert("Failed to open feedback details. Please try again.");
    }
  };

  // Get the official office name for print header
  const printOfficeName = useMemo(() => {
    if (isOfficeAdmin && user?.office) {
      return (
        getOfficialOfficeName(user.office, offices) ||
        user.office
      );
    } else if (office && office !== "") {
      return getOfficialOfficeName(office, offices) || office;
    }
    return "Office of the College of Computing and Information Sciences";
  }, [isOfficeAdmin, user?.office, office, offices]);

  const printRows = useMemo(() => {
    const rowsByOffice = new Map();

    filteredFeedbacks.forEach((feedback) => {
      const officeName = toTrimmedText(feedback?.office) || "Unspecified";

      if (!rowsByOffice.has(officeName)) {
        rowsByOffice.set(officeName, {
          office: officeName,
          commendations: [],
          suggestions: [],
        });
      }

      const row = rowsByOffice.get(officeName);
      const commendation = toTrimmedText(feedback?.commendation);
      const suggestion = toTrimmedText(feedback?.suggestion);

      if (
        commendation &&
        commendation !== "No commendation provided." &&
        !row.commendations.includes(commendation)
      ) {
        row.commendations.push(commendation);
      }

      if (
        suggestion &&
        suggestion !== "No suggestion provided." &&
        !row.suggestions.includes(suggestion)
      ) {
        row.suggestions.push(suggestion);
      }
    });

    const rows = [...rowsByOffice.values()].sort((a, b) =>
      a.office.localeCompare(b.office)
    );

    return rows;
  }, [filteredFeedbacks]);

  const reportMonthLabel = useMemo(() => {
    let sourceDate = null;

    const rangeDate = dayRange.start || dayRange.end;
    if (rangeDate) {
      const [year, month] = rangeDate.split("-").map(Number);
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        sourceDate = new Date(year, month - 1, 1);
      }
    }

    if (!sourceDate && filteredFeedbacks.length > 0) {
      const createdAt = filteredFeedbacks[0]?.createdAt;

      if (createdAt?.toDate) {
        sourceDate = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        sourceDate = createdAt;
      } else if (typeof createdAt === "string") {
        const parsed = new Date(createdAt);
        if (!Number.isNaN(parsed.getTime())) {
          sourceDate = parsed;
        }
      }
    }

    if (!sourceDate) {
      sourceDate = new Date();
    }

    return sourceDate
      .toLocaleDateString("en-US", { month: "long", year: "numeric" })
      .toUpperCase();
  }, [dayRange.start, dayRange.end, filteredFeedbacks]);

  const preparedByNameForPrint =
    toTrimmedText(printSignatories.prepared) || "________________________";
  const verifiedByNameForPrint =
    toTrimmedText(printSignatories.verified) || "________________________";
  const approvedByNameForPrint =
    toTrimmedText(printSignatories.approved) || "________________________";
  const documentCodeForPrint =
    toTrimmedText(printFooterFields.documentCode) || "F-AQA-CSF-002";
  const revisionNumberForPrint =
    toTrimmedText(printFooterFields.revisionNumber) || "Rev. 3";
  const printedDateForPrint =
    printFooterSnapshot.printedDate || formatPrintFooterDate(new Date());
  const printFooterContentPrefix = `${documentCodeForPrint} | ${revisionNumberForPrint} | ${printedDateForPrint} | Page `;
  const printFooterPrefixCSS = JSON.stringify(printFooterContentPrefix);
  const PRINT_PAGE_WIDTH_IN = 13;
  const PRINT_PAGE_HEIGHT_IN = 8.5;
  const PRINT_PAGE_MARGIN_TOP_CM = 1.27;
  const PRINT_PAGE_MARGIN_RIGHT_CM = 1.27;
  const PRINT_PAGE_MARGIN_BOTTOM_CM = 1.9;
  const PRINT_PAGE_MARGIN_LEFT_CM = 1.27;
  const PRINT_MARGIN_TOTAL_CM =
    PRINT_PAGE_MARGIN_LEFT_CM + PRINT_PAGE_MARGIN_RIGHT_CM;

  const renderPrintList = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <span>N/A</span>;
    }

    return (
      <ul className="list-disc pl-4 space-y-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading feedback data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center text-red-500 bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md mx-auto">
          <p className="text-lg font-semibold">Error Loading Feedback</p>
          <p className="mt-2">{error.message || "Failed to load feedback data"}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle case where feedbacks is not an array
  if (!Array.isArray(feedbacks)) {
    return (
      <div className="min-h-screen dark:bg-[#1f1f1f] flex items-center justify-center">
        <div className="text-center text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg max-w-md mx-auto">
          <p className="text-lg font-semibold">Data Format Issue</p>
          <p className="mt-2">Feedback data is not in the expected format.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen View */}
      <div className="print:hidden min-h-screen dark:bg-[#1f1f1f]">
        <div className="px-4 sm:px-8 pt-6 pb-6 space-y-6 flex flex-col">
         
          {/* 🔍 Filters */}
          <FilterBar
            search={search}
            setSearch={setSearch}
            dayRange={dayRange}
            setDayRange={setDayRange}
            office={office}
            setOffice={setOffice}
            exportCSV={exportCSV}
            exportPDF={exportPDF}
            officeOptions={officeOptions}
            user={user}
            totalCount={feedbacks.length}
            filteredCount={filteredFeedbacks.length}
            onGenerateQRCode={openManualQrSettings}
            isGeneratingQRCode={isGeneratingQr}
          />

          {/* 📋 Feedback Table */}
          {filteredFeedbacks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
              {feedbacks.length === 0 
                ? "No feedback data available yet." 
                : "No feedback matches your filters."}
            </div>
          ) : (
            <>
              <FeedbackTable
                visitors={filteredFeedbacks}
                onViewFull={handleViewFull}
              />
            </>
          )}
        </div>

        {/* Modal Overlay */}
        {selectedVisitor && (
          <FeedbackModal
            isOpen={!!selectedVisitor}
            onClose={() => setSelectedVisitor(null)}
            visitor={selectedVisitor}
          />
        )}

        {manualQrSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:text-gray-100">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Generate Manual Feedback QR
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Admin approval for anonymous paper-form encoding.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualQrSettingsOpen(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  aria-label="Close manual QR settings"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Office
                  </label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    {isOfficeAdmin
                      ? user?.office || "Assigned Office"
                      : office || "All Offices"}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Token Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setManualQrSettings((previous) => ({
                          ...previous,
                          mode: "single",
                          maxUses: 1,
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        manualQrSettings.mode === "single"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      Single-use
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setManualQrSettings((previous) => ({
                          ...previous,
                          mode: "batch",
                          maxUses: Math.max(2, Number(previous.maxUses) || 25),
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        manualQrSettings.mode === "batch"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      Batch
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Expires In
                    </label>
                    <select
                      value={manualQrSettings.expiresInHours}
                      onChange={(event) =>
                        setManualQrSettings((previous) => ({
                          ...previous,
                          expiresInHours: Number(event.target.value),
                        }))
                      }
                      className="h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:bg-gray-900 dark:text-gray-200"
                    >
                      <option value={1}>1 hour</option>
                      <option value={8}>8 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={72}>3 days</option>
                      <option value={168}>7 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      disabled={manualQrSettings.mode === "single"}
                      value={manualQrSettings.mode === "single" ? 1 : manualQrSettings.maxUses}
                      onChange={(event) =>
                        setManualQrSettings((previous) => ({
                          ...previous,
                          maxUses: Number(event.target.value),
                        }))
                      }
                      className="h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-900 dark:text-gray-200 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setManualQrSettingsOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateQRCode}
                  disabled={isGeneratingQr}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed"
                >
                  <QrCode size={16} />
                  {isGeneratingQr ? "Generating..." : "Generate Approval QR"}
                </button>
              </div>
            </div>
          </div>
        )}

        {qrModalOpen && generatedQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:text-gray-100">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Manual Feedback Approval QR
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {generatedQr.officialOfficeName || generatedQr.office}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  aria-label="Close QR code modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-5 py-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <img
                      src={buildQrImageUrl(generatedQr.url)}
                      alt="Generated feedback QR code"
                      className="h-[280px] w-[280px]"
                    />
                  </div>

                  <div className="w-full space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Approval
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        {generatedQr.type === "batch"
                          ? `Batch token, ${generatedQr.maxUses} maximum uses`
                          : "Single-use token"}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Link
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm break-all text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        {generatedQr.url}
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Expires {generatedQr.expiresAt.toLocaleString()}. Manual submissions should be saved as anonymous paper-form entries.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-700">
                <button
                  type="button"
                  onClick={copyGeneratedUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Clipboard size={16} /> Copy Link
                </button>
                <a
                  href={buildQrImageUrl(generatedQr.url)}
                  download={`feedback-qr-${generatedQr.token}.png`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Download size={16} /> Download
                </a>
                <button
                  type="button"
                  onClick={printGeneratedQr}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print View Only - CSF Monthly Commendations & Suggestions */}
      <div className="hidden print:block bg-white print-only-section text-black">
        <div className="csf-page p-6">
          <table className="print-wrapper w-full border-collapse">
            <thead>
              <tr>
                <th className="print-header-cell">
                  <div className="flex items-start justify-between mb-4 gap-5">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 flex items-center justify-center">
                        <img src={bisuLogo} alt="BISU Logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-[14.67px]">Republic of the Philippines</p>
                        <h1 className="text-[16px] font-bold tracking-wide print-header-title">
                          BOHOL ISLAND STATE UNIVERSITY
                        </h1>
                        <p className="text-[13.33px]">Magsija, Balilihan 6342, Bohol, Philippines</p>
                        <p className="text-[13.33px]">{printOfficeName}</p>
                        <p className="text-[13.33px] italic">Balance | Integrity | Stewardship | Uprightness</p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      <div className="w-24 h-16 flex items-center justify-center">
                        <img
                          src={bagongPilipinasLogo}
                          alt="Bagong Pilipinas Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="w-32 h-16 flex items-center justify-center">
                        <img src={tuvISOLogo} alt="ISO 9001:2015 Certification" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
              <tr>
                <th>
                  <h2 className="text-center text-[20px] tracking-wide uppercase mb-2">
                    Monthly Customer Satisfaction Summary Form -{" "}
                    <span className="underline">{reportMonthLabel}</span>
                  </h2>

                  
                </th>
                
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <p className="text-[18px] font-semibold mb-2 text-left">
                    CSF Monthly Commendations &amp; Suggestions
                  </p>
                  <table className="w-full border-collapse csf-table">
                    <thead>
                      
                      <tr>
                        <th rowSpan={2} className="w-[16%]">Office</th>
                        <th rowSpan={2} className="w-[18%]">Commendation</th>
                        <th rowSpan={2} className="w-[18%]">Detail of Suggestions</th>
                        <th rowSpan={2} className="w-[7%]">Root Cause</th>
                        <th rowSpan={2} className="w-[8%]">Action Plan</th>
                        <th rowSpan={2} className="w-[9%]">Target of Implementation</th>
                        <th colSpan={3} className="w-[24%]">Status of Implementation</th>
                      </tr>
                      <tr>
                        <th>Implementation (Closed)</th>
                        <th>On-going / To be Implemented (Open)</th>
                        <th>Not Implemented</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printRows.map((row, index) => (
                        <tr key={`${row.office}-${index}`}>
                          <td>{row.office}</td>
                          <td>{renderPrintList(row.commendations)}</td>
                          <td>{renderPrintList(row.suggestions)}</td>
                          <td className="text-center">N/A</td>
                          <td className="text-center">N/A</td>
                          <td className="text-center">N/A</td>
                          <td className="text-center">N/A</td>
                          <td className="text-center">N/A</td>
                          <td className="text-center">N/A</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr className="csf-signatories-row">
                <td className="csf-signatories-cell">
                  <div className="mt-10 text-[13px] feedback-signatories">
                    <div className="grid grid-cols-2 gap-24 mb-6 feedback-signatories-row">
                      <div className="text-center feedback-signatory-group">
                        <p className="text-left mb-3">Prepared:</p>
                        <p className="font-semibold underline feedback-signatory-name">
                          {preparedByNameForPrint}
                        </p>
                        <p>Administrative Aide VI</p>
                      </div>

                      <div className="text-center feedback-signatory-group">
                        <p className="text-left mb-3">Verified:</p>
                        <p className="font-semibold underline feedback-signatory-name">
                          {verifiedByNameForPrint}
                        </p>
                        <p>Human Resource Management Officer II</p>
                      </div>
                    </div>

                    <div className="max-w-md mx-auto text-center feedback-signatories-row">
                      <div className="feedback-signatory-group">
                        <p className="mb-3 text-left pl-10">Approved:</p>
                        <p className="font-semibold underline feedback-signatory-name">
                          {approvedByNameForPrint}
                        </p>
                        <p>Campus Director</p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showPrintSignatoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/15 backdrop-blur-md p-4 no-print print:hidden">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#faf5ff_0%,#ffffff_58%,#f8fafc_100%)] px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#553C9A] text-white shadow-lg shadow-violet-200/70">
                    <Printer size={18} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      Print Settings
                    </h3>
                    <p className="mt-1 max-w-xl text-sm text-slate-600">
                      Update the report signatories and footer details before
                      printing.
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-xs font-medium text-violet-700">
                  <FileText size={14} />
                  <span>Feedback Report</span>
                </div>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.95fr]">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Signatories
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      These names will appear under the printed report.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      <span>Prepared</span>
                      <input
                        type="text"
                        value={printSignatories.prepared}
                        onChange={(e) =>
                          handlePrintSignatoryChange("prepared", e.target.value)
                        }
                        placeholder="Enter name"
                        className="h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      <span>Verified</span>
                      <input
                        type="text"
                        value={printSignatories.verified}
                        onChange={(e) =>
                          handlePrintSignatoryChange("verified", e.target.value)
                        }
                        placeholder="Enter name"
                        className="h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>Approved</span>
                    <input
                      type="text"
                      value={printSignatories.approved}
                      onChange={(e) =>
                        handlePrintSignatoryChange("approved", e.target.value)
                      }
                      placeholder="Enter name"
                      className="h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </label>
                </section>

                <section className="rounded-2xl border border-violet-100 bg-[linear-gradient(180deg,#fcfaff_0%,#ffffff_100%)] p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Footer
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Date and page number are filled in automatically.
                      </p>
                    </div>
                    <div className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Auto
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      <span>Document Code</span>
                      <input
                        type="text"
                        value={printFooterFields.documentCode}
                        onChange={(e) =>
                          handlePrintFooterFieldChange(
                            "documentCode",
                            e.target.value,
                          )
                        }
                        placeholder="Enter document code"
                        className="h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      <span>Revision Number</span>
                      <input
                        type="text"
                        value={printFooterFields.revisionNumber}
                        onChange={(e) =>
                          handlePrintFooterFieldChange(
                            "revisionNumber",
                            e.target.value,
                          )
                        }
                        placeholder="Enter revision number"
                        className="h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Print Date
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {formatPrintFooterDate(new Date())}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Page Count
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          Auto on print
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-violet-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                        Footer Preview
                      </p>
                      <p className="mt-2 break-words text-sm text-slate-700">
                        {documentCodeForPrint} | {revisionNumberForPrint} |{" "}
                        {formatPrintFooterDate(new Date())} | Page 1 of N
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setShowPrintSignatoryModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPrint}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#553C9A] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200/70 hover:bg-[#44307B]"
              >
                <Printer size={16} />
                <span>Continue to Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: ${PRINT_PAGE_WIDTH_IN}in ${PRINT_PAGE_HEIGHT_IN}in;
            margin: ${PRINT_PAGE_MARGIN_TOP_CM}cm ${PRINT_PAGE_MARGIN_RIGHT_CM}cm ${PRINT_PAGE_MARGIN_BOTTOM_CM}cm ${PRINT_PAGE_MARGIN_LEFT_CM}cm;
            @bottom-left {
              content: ${printFooterPrefixCSS} counter(page) " of " counter(pages);
              font-family: Arial, sans-serif;
              font-size: 11px;
              font-weight: 400;
              text-align: left;
              vertical-align: top;
              padding-top: 0.15cm;
              white-space: nowrap;
            }
          }

          body * {
            visibility: hidden;
          }
          
          .print-only-section,
          .print-only-section * {
            visibility: visible;
          }
          
          .print-only-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            margin: 0;
            padding: 0;
          }

          .print-wrapper > thead {
          display: table-header-group;
        }

        .print-wrapper > tbody {
          display: table-row-group;
        }

        .print-wrapper > thead > tr > th,
        .print-wrapper > thead > tr > td,
        .print-wrapper > tbody > tr > td {
          border: none !important;
          padding: 0;
          vertical-align: top;
        }

        .print-wrapper .print-header-cell {
          text-align: left;
          font-weight: normal;
        }

        .print-header-title {
          font-family: "Arial, sans-serif";
        }

        .print-header-title {
          font-family: Arial, sans-serif;
        }
          html,
          body {
            margin: 0;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .csf-section {
          page-break-inside: auto;
          break-inside: auto;
        }

          .csf-table th,
          .csf-table td {
            border: 1px solid #000 !important;
            vertical-align: top;
            word-break: break-word;
            overflow-wrap: anywhere;
            white-space: normal;
            box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          }

          .csf-table th {
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            padding: 6px 4px;
          }

          .csf-table {
            width: 100%;
            table-layout: fixed;
            page-break-inside: auto;
            break-inside: auto;
            border-collapse: separate;
            border-spacing: 0;
          }

          .csf-table thead {
          display: table-row-group !important;
        }

          .csf-table thead tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .csf-table tbody {
            display: table-row-group;
          }

          .csf-table tbody tr {
            page-break-inside: auto;
            break-inside: auto;
          }

          .csf-table td {
            font-size: 10px;
            padding: 6px 6px;
            page-break-inside: auto;
          break-inside: auto;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
          vertical-align: top;
          }

          .csf-table ul {
            margin: 0;
            padding-left: 14px;
          }

          .csf-table li {
            margin-bottom: 3px;
          }

          .csf-signatories-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .csf-signatories-cell {
            border: none !important;
            padding: 12px 0 0 !important;
          }

          .feedback-signatories,
          .feedback-signatories-row,
          .feedback-signatory-group {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .feedback-signatory-name {
            white-space: nowrap;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
};

export default Feedback;
