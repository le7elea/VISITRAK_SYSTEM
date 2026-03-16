﻿﻿import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
BarChart2,
ChevronDown,
MoreHorizontal,
MessageSquare,
Calendar,
FileText,
Printer,
Smile,
Meh,
Frown,
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import bisuLogo from '../assets/bisulogo.png';
import bagongPilipinasLogo from '../assets/bagong_pilipinas_logo.png';
import tuvISOLogo from '../assets/tuvISO_logo.png';

const toTrimmedText = (value) => (typeof value === 'string' ? value.trim() : '');

const getNumericRating = (value) => {
if (typeof value === 'number' && Number.isFinite(value)) {
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

if (answer && typeof answer === 'object') {
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

if (typeof answers === 'object') {
return Object.entries(answers).map(([question, rating], index) => ({
question: toTrimmedText(question) || `Question ${index + 1}`,
rating: getNumericRating(rating),
}));
}

return [];
};

const getReadableValue = (value) => {
if (value === null || value === undefined) return '';
if (typeof value === 'string') return value.trim();
if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();

if (typeof value === 'object') {
const candidate = value.value ?? value.label ?? value.name ?? value.text ?? value.selected ?? value.type;
if (candidate !== undefined && candidate !== null) {
return getReadableValue(candidate);
}
}

return '';
};

const findValueByKeyPattern = (obj, patterns = [], depth = 3) => {
if (!obj || typeof obj !== 'object' || depth < 0) return '';

for (const [key, value] of Object.entries(obj)) {
const matchesKey = patterns.some((pattern) => pattern.test(key));
if (matchesKey) {
const extracted = getReadableValue(value);
if (extracted) return extracted;
}

if (value && typeof value === 'object') {
const nested = findValueByKeyPattern(value, patterns, depth - 1);
if (nested) return nested;
}
}

return '';
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
[/^sex$/i, /^gender$/i, /visitor.*sex/i, /visitor.*gender/i, /client.*sex/i, /client.*gender/i],
3
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
3
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
new RegExp(`^cc[-_\\s]*${questionNumber}$`, 'i'),
new RegExp(`citizens?charter.*cc[-_\\s]*${questionNumber}`, 'i'),
new RegExp(`charter.*${questionNumber}$`, 'i'),
],
5
);

const fallbackNumeric = getNumericRating(fallback);
return fallbackNumeric !== null ? fallbackNumeric : null;
};

const normalizeSex = (value) => {
const text = toTrimmedText(value).toLowerCase();
if (!text) return '';
if (text === 'm' || text === 'male' || text.startsWith('male') || text === 'man' || text === 'boy') return 'M';
if (text === 'f' || text === 'female' || text.startsWith('female') || text === 'woman' || text === 'girl') return 'F';
return '';
};

const normalizeClientType = (value) => {
const text = toTrimmedText(value).toLowerCase();
if (!text) return '';
if (
text.includes('citizen') ||
text.includes('individual') ||
text.includes('resident') ||
text.includes('student') ||
text.includes('faculty') ||
text.includes('employee') ||
text.includes('parent') ||
text.includes('alumni')
) {
return 'citizens';
}
if (text.includes('business') || text.includes('company') || text.includes('corporate') || text.includes('enterprise')) {
return 'business';
}
if (
text.includes('government') ||
text.includes('govt') ||
text.includes('gov') ||
text.includes('agency') ||
text.includes('public')
) {
return 'government';
}
return '';
};

const normalizeCharterRating = (value, questionIndex) => {
const numeric = getNumericRating(value);
if (numeric === null) return null;

const rounded = Math.round(numeric);
if (questionIndex === 1) {
if (rounded >= 1 && rounded <= 5) return rounded;
return null;
}

if (rounded >= 1 && rounded <= 4) return rounded;
if (rounded === 5) return 4;
return null;
};

const normalizeFivePointRating = (value) => {
const numeric = getNumericRating(value);
if (numeric === null) return null;

const rounded = Math.round(numeric);
if (rounded >= 1 && rounded <= 5) return rounded;
return null;
};

const formatCountCell = (value, hasData = true) => {
if (!hasData) return '-';
return `${value || 0}`;
};

const formatScoreCell = (value) => {
if (value === null || value === undefined || Number.isNaN(value)) return '-';
return Number(value).toFixed(2);
};

const calculateMeanSatisfaction = (feedbacks = []) => {
const ratings = feedbacks
.map((feedback) => normalizeFivePointRating(feedback?.averageRating))
.filter((value) => value !== null);

if (!ratings.length) return null;
return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
};

const getSatisfactionDescription = (value) => {
if (value === null || value === undefined || Number.isNaN(value)) return '-';
if (value < 0) return '-';
if (value < 1) return 'Very Unsatisfied';
if (value < 2) return 'Unsatisfied';
if (value < 3) return 'Neither Satisfied nor Dissatisfied';
if (value < 4) return 'Satisfied';
return 'Very Satisfied';
};

const calculateSatisfactionRates = (feedbacks = []) => {
const ratings = feedbacks
.map((feedback) => getNumericRating(feedback?.averageRating))
.filter((rating) => rating !== null && rating >= 0 && rating <= 5);

const total = ratings.length;
if (total === 0) return [];

const counts = {
verySatisfied: ratings.filter((rating) => rating >= 4 && rating <= 5).length,
satisfied: ratings.filter((rating) => rating >= 3 && rating < 4).length,
neitherSatisfiedNorDissatisfied: ratings.filter((rating) => rating >= 2 && rating < 3).length,
unsatisfied: ratings.filter((rating) => rating >= 1 && rating < 2).length,
veryUnsatisfied: ratings.filter((rating) => rating >= 0 && rating < 1).length,
};

return [
{ label: 'Very Satisfied', pct: Math.round((counts.verySatisfied / total) * 100) },
{ label: 'Satisfied', pct: Math.round((counts.satisfied / total) * 100) },
{ label: 'Neither Satisfied nor Dissatisfied', pct: Math.round((counts.neitherSatisfiedNorDissatisfied / total) * 100) },
{ label: 'Unsatisfied', pct: Math.round((counts.unsatisfied / total) * 100) },
{ label: 'Very Unsatisfied', pct: Math.round((counts.veryUnsatisfied / total) * 100) },
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

const SatisfactionIcon = ({ label, className = "w-4 h-4" }) => {
if (label === 'Very Satisfied' || label === 'Satisfied') {
return <Smile className={className} />;
}
if (label === 'Neither Satisfied nor Dissatisfied') {
return <Meh className={className} />;
}
return <Frown className={className} />;
};

// Helper function to normalize office names - UPDATED
const normalizeOfficeName = (officeName) => {
if (!officeName) return "";
let normalized = officeName.toString().trim();
normalized = normalized.replace(/\s+/g, ' '); // Replace multiple spaces with single space
// Don't remove special characters like / - just normalize spaces
return normalized;
};

const toComparableOfficeKey = (officeName) =>
normalizeOfficeName(officeName)
.toLowerCase()
.replace(/[^\w\s/.-]/g, '');

const findOfficeRecordByName = (officeName, officeRecords = []) => {
const normalized = normalizeOfficeName(officeName);
if (!normalized || !Array.isArray(officeRecords) || officeRecords.length === 0) return null;

const sourceKey = toComparableOfficeKey(normalized);
if (!sourceKey) return null;

return (
officeRecords.find((office) => {
const nameKey = toComparableOfficeKey(office?.name);
const officialKey = toComparableOfficeKey(office?.officialName);
return sourceKey === nameKey || sourceKey === officialKey;
}) || null
);
};

const toOfficialOfficeDisplayName = (officeName, officeRecords = []) => {
const normalized = normalizeOfficeName(officeName);
if (!normalized) return "";

const matchedOffice = findOfficeRecordByName(normalized, officeRecords);
return (
normalizeOfficeName(matchedOffice?.officialName) ||
normalizeOfficeName(matchedOffice?.name) ||
normalized
);
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

const formatNameList = (names = []) => {
const uniqueNames = [...new Set(names.filter(Boolean))];
if (uniqueNames.length === 0) return '';
if (uniqueNames.length === 1) return uniqueNames[0];
if (uniqueNames.length === 2) return `${uniqueNames[0]} and ${uniqueNames[1]}`;
return `${uniqueNames.slice(0, -1).join(', ')}, and ${uniqueNames[uniqueNames.length - 1]}`;
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
const Card = ({ children, className = "", ...props }) => (
<div
className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}
{...props}
>
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
<Smile size={14} className="text-yellow-700" />
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
<SatisfactionIcon
label={item.label}
className={`w-4 h-4 ${idx < 3 ? 'text-yellow-600' : 'text-gray-500'}`}
/>
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
<Meh size={20} className="text-yellow-600" />
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
const Analytics = ({ setActiveTab }) => {
// State for visits from database
const [visits, setVisits] = useState([]);
// State for feedbacks from database
const [feedbacks, setFeedbacks] = useState([]);
// State for office metadata (official names)
const [offices, setOffices] = useState([]);
const [loading, setLoading] = useState(true);
const [currentUser, setCurrentUser] = useState(null);
const canOpenFeedbackTab = typeof setActiveTab === "function";

const handleOpenFeedbackTab = () => {
if (!canOpenFeedbackTab) return;
setActiveTab("feedback");
};

const handleFeedbackCardKeyDown = (event) => {
if (!canOpenFeedbackTab) return;
if (event.key === "Enter" || event.key === " ") {
event.preventDefault();
handleOpenFeedbackTab();
}
};

// Get current user on component mount
useEffect(() => {
const user = getCurrentUser();
setCurrentUser(user);

if (!user) {
console.warn("?? No user found in localStorage");
} else {
console.log("?? Current user:", user);
console.log("?? User office - Original:", user.originalOffice, "Normalized:", user.office);
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

console.log("?? Starting visits fetch for:", currentUser.type, currentUser.originalOffice || currentUser.office);

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
sex: getVisitSexValue(d),
clientType: getVisitClientTypeValue(d),
cc1Rating: getCharterRatingValue(d, 1),
cc2Rating: getCharterRatingValue(d, 2),
cc3Rating: getCharterRatingValue(d, 3),
checkInTime: d.checkInTime,
checkOutTime: d.checkOutTime,
purpose: d.purpose || '',
status: d.status || 'checked-in'
};
});

console.log(`?? Fetched ${allVisits.length} total visits from Firestore`);

// Filter visits by office if OfficeAdmin
let filteredVisits = allVisits;
if (currentUser && currentUser.type === "OfficeAdmin" && currentUser.office) {
const userOffice = currentUser.originalOffice || currentUser.office;
console.log(`?? Filtering visits for office: "${userOffice}"`);

filteredVisits = allVisits.filter(visit => {
if (!visit.office) return false;

// Use flexible comparison
const matches = compareOfficeNames(visit.office, userOffice);
if (matches) {
console.log(`? Visit ${visit.id} matches office:`, visit.office);
}
return matches;
});

console.log(`?? After filtering: ${filteredVisits.length} visits for this office`);

// Debug: Show unique office names found
const uniqueOffices = [...new Set(filteredVisits.map(v => v.office).filter(Boolean))];
console.log("?? Unique offices in filtered visits:", uniqueOffices);

// Also show all offices in database for debugging
const allUniqueOffices = [...new Set(allVisits.map(v => v.office).filter(Boolean))];
console.log("?? All offices in database:", allUniqueOffices);
} else {
console.log("?? SuperAdmin: Keeping all visits");
}

setVisits(filteredVisits);
setLoading(false);
}, (error) => {
console.error("? Error fetching visits:", error);
setLoading(false);
});

return () => {
console.log("?? Cleaning up visits listener");
if (visitsUnsub) visitsUnsub();
};
}, [currentUser]);

// Fetch feedbacks from Firestore with office filtering - FIXED VERSION
useEffect(() => {
if (!currentUser) {
return;
}

let feedbackUnsub = null;

try {
if (currentUser.type === "OfficeAdmin" && currentUser.office) {
const userOffice = currentUser.originalOffice || currentUser.office;

if (visits.length === 0) {
setFeedbacks([]);
return;
}

const officeVisitIds = visits.map((visit) => visit.id);
if (officeVisitIds.length === 0) {
setFeedbacks([]);
return;
}

const feedbackQuery = query(
collection(db, "feedbacks"),
orderBy("createdAt", "desc")
);

feedbackUnsub = onSnapshot(
feedbackQuery,
(feedbackSnapshot) => {
const allFeedbacks = feedbackSnapshot.docs.map((doc) => {
const d = doc.data();
return {
id: doc.id,
visitId: d.visitId,
name: d.name,
office:
d.office || d.unitOfficeVisited || d.officeVisited || d.unitOffice || "",
sex: getVisitSexValue(d),
clientType: getVisitClientTypeValue(d),
cc1Rating: getCharterRatingValue(d, 1),
cc2Rating: getCharterRatingValue(d, 2),
cc3Rating: getCharterRatingValue(d, 3),
answers: d.answers || [],
questions: Array.isArray(d.questions) ? d.questions : [],
averageRating: d.averageRating || 0,
commendation:
d.commendation ||
d.commendations ||
d.positiveFeedback ||
d.compliment ||
"",
suggestion: d.suggestion || "",
createdAt: d.createdAt,
};
});

const filteredData = allFeedbacks.filter((feedback) =>
officeVisitIds.includes(feedback.visitId)
);
console.log(
`After filtering: ${filteredData.length} feedbacks for office "${userOffice}"`
);
setFeedbacks(filteredData);
},
(error) => {
console.error("Error fetching feedbacks:", error);
}
);
} else {
const feedbackQuery = query(
collection(db, "feedbacks"),
orderBy("createdAt", "desc")
);

feedbackUnsub = onSnapshot(
feedbackQuery,
(snapshot) => {
const data = snapshot.docs.map((doc) => {
const d = doc.data();
return {
id: doc.id,
visitId: d.visitId,
name: d.name,
office:
d.office || d.unitOfficeVisited || d.officeVisited || d.unitOffice || "",
sex: getVisitSexValue(d),
clientType: getVisitClientTypeValue(d),
cc1Rating: getCharterRatingValue(d, 1),
cc2Rating: getCharterRatingValue(d, 2),
cc3Rating: getCharterRatingValue(d, 3),
answers: d.answers || [],
questions: Array.isArray(d.questions) ? d.questions : [],
averageRating: d.averageRating || 0,
commendation:
d.commendation ||
d.commendations ||
d.positiveFeedback ||
d.compliment ||
"",
suggestion: d.suggestion || "",
createdAt: d.createdAt,
};
});

console.log(`Fetched ${data.length} feedbacks`);
setFeedbacks(data);
},
(error) => {
console.error("Error fetching feedbacks:", error);
}
);
}
} catch (error) {
console.error("Error setting up feedbacks listener:", error);
}

return () => {
if (feedbackUnsub) {
feedbackUnsub();
}
};
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

const getDefaultMonthRange = () => {
const defaults = getDefaultDateRange();
const monthValue = defaults.end.slice(0, 7);
return {
start: monthValue,
end: monthValue,
};
};

const [dateRange, setDateRange] = useState(getDefaultDateRange());
const [dateRangeMode, setDateRangeMode] = useState("day");
const [monthRange, setMonthRange] = useState(getDefaultMonthRange());
const [pendingDayRange, setPendingDayRange] = useState(getDefaultDateRange());
const [selectedOfficeFilter, setSelectedOfficeFilter] = useState("all");
const [showDayRangeDropdown, setShowDayRangeDropdown] = useState(false);
const [showIntegratedModal, setShowIntegratedModal] = useState(false);
const [showOverallModal, setShowOverallModal] = useState(false);
const [showPrintSignatoryModal, setShowPrintSignatoryModal] = useState(false);
const [printSignatories, setPrintSignatories] = useState({
prepared: "MA. MAELITH L. BUCHAN",
verified: "HORONORIO O. UEHARA",
approved: "MARRIETA C. MACALOLOT, PhD",
});
const dayRangeDropdownRef = useRef(null);

const handlePrintSignatoryChange = (role, value) => {
setPrintSignatories((previous) => ({
...previous,
[role]: value,
}));
};

useEffect(() => {
if (!showDayRangeDropdown) return undefined;

const handleOutsideClick = (event) => {
if (
dayRangeDropdownRef.current &&
!dayRangeDropdownRef.current.contains(event.target)
) {
setShowDayRangeDropdown(false);
}
};

document.addEventListener("mousedown", handleOutsideClick);
document.addEventListener("touchstart", handleOutsideClick);

return () => {
document.removeEventListener("mousedown", handleOutsideClick);
document.removeEventListener("touchstart", handleOutsideClick);
};
}, [showDayRangeDropdown]);

const formatDateDisplay = (dateStr) => {
try {
const date = new Date(dateStr);
if (isNaN(date.getTime())) return dateStr;
const options = { month: 'short', day: '2-digit', year: 'numeric' };
return date.toLocaleDateString('en-US', options);
} catch {
return dateStr;
}
};

const formatCompactDateDisplay = (dateStr) => {
try {
const date = new Date(dateStr);
if (isNaN(date.getTime())) return dateStr;
return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
} catch {
return dateStr;
}
};

const formatDateInputValue = (date) => {
if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
return `${year}-${month}-${day}`;
};

const monthValueToBoundaryDate = (value, boundary = "start") => {
if (!value) return null;
const [year, month] = value.split("-").map(Number);
if (!year || !month) return null;
if (boundary === "end") {
return new Date(year, month, 0);
}
return new Date(year, month - 1, 1);
};

const formatMonthDisplay = (monthValue) => {
const monthDate = monthValueToBoundaryDate(monthValue, "start");
if (!monthDate) return monthValue || "";
return monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const applyMonthRangeToDateRange = (range) => {
const startDateRaw = monthValueToBoundaryDate(range.start, "start");
const endDateRaw = monthValueToBoundaryDate(range.end, "end");
if (!startDateRaw || !endDateRaw) return;

let startDate = startDateRaw;
let endDate = endDateRaw;

if (startDate > endDate) {
startDate = monthValueToBoundaryDate(range.end, "start");
endDate = monthValueToBoundaryDate(range.start, "end");
}

if (!startDate || !endDate) return;

setDateRange({
start: formatDateInputValue(startDate),
end: formatDateInputValue(endDate),
});
};

const handleDateRangeModeChange = (nextMode) => {
setDateRangeMode(nextMode);

if (nextMode === "month") {
const monthValue = dateRange.start ? dateRange.start.slice(0, 7) : monthRange.start;
setMonthRange({
start: monthValue,
end: monthValue,
});
return;
}

setPendingDayRange({
start: dateRange.start,
end: dateRange.end,
});
};

const handleMonthRangeChange = (value) => {
if (!value) return;
setMonthRange({
start: value,
end: value,
});
};

const handleDayRangeChange = (field, value) => {
if (!value) return;
setPendingDayRange((prev) => {
const next = {
...prev,
[field]: value,
};

if (next.start && next.end && next.start > next.end) {
if (field === "start") {
next.end = value;
} else {
next.start = value;
}
}

return next;
});
};

const applyDayRangeSelection = () => {
if (!pendingDayRange.start || !pendingDayRange.end) return;
setDateRange({
start: pendingDayRange.start,
end: pendingDayRange.end,
});
setShowDayRangeDropdown(false);
};

const applyMonthRangeSelection = () => {
if (!monthRange.start) return;
applyMonthRangeToDateRange({
start: monthRange.start,
end: monthRange.start,
});
setShowDayRangeDropdown(false);
};

const dateRangeDropdownLabel = (() => {
if (dateRangeMode === "month") {
if (!monthRange.start) return "Select month";
return `Month: ${formatMonthDisplay(monthRange.start)}`;
}

if (dateRange.start && dateRange.end) {
return `Day: ${formatCompactDateDisplay(dateRange.start)} - ${formatCompactDateDisplay(dateRange.end)}`;
}

return "Select date range";
})();

const parseLocalDate = (dateStr) => {
if (!dateStr) return null;
const parts = dateStr.split('-').map(Number);
if (parts.length !== 3) return null;
const [year, month, day] = parts;
if (!year || !month || !day) return null;
return new Date(year, month - 1, day);
};

const officeFilterOptions = useMemo(() => {
const officeMap = new Map();

const addOffice = (value) => {
const normalized = normalizeOfficeName(value);
if (!normalized) return;
const key = normalized.toLowerCase();
if (!officeMap.has(key)) {
officeMap.set(key, normalized);
}
};

if (currentUser?.type === "OfficeAdmin") {
addOffice(currentUser.originalOffice || currentUser.office);
}

offices
.filter((office) => (office?.role || '').toLowerCase() !== 'super')
.forEach((office) => addOffice(office?.name || office?.officialName));

visits.forEach((visit) => addOffice(visit?.office));
feedbacks.forEach((feedback) => addOffice(feedback?.office));

return [...officeMap.values()].sort((a, b) => a.localeCompare(b));
}, [currentUser, offices, visits, feedbacks]);

useEffect(() => {
if (currentUser?.type !== "OfficeAdmin") return;

const officeFromUser = normalizeOfficeName(currentUser.originalOffice || currentUser.office);
if (!officeFromUser) return;

const matchedOffice = officeFilterOptions.find((officeName) =>
compareOfficeNames(officeName, officeFromUser)
);
const nextOfficeFilter = matchedOffice || officeFromUser;

setSelectedOfficeFilter((prev) =>
compareOfficeNames(prev, nextOfficeFilter) ? prev : nextOfficeFilter
);
}, [currentUser, officeFilterOptions]);

useEffect(() => {
if (currentUser?.type === "OfficeAdmin") return;
if (selectedOfficeFilter === "all") return;
const stillExists = officeFilterOptions.some((officeName) =>
compareOfficeNames(officeName, selectedOfficeFilter)
);

if (!stillExists) {
setSelectedOfficeFilter("all");
}
}, [currentUser, officeFilterOptions, selectedOfficeFilter]);

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

const inDateRange = checkInDate >= startDate && checkInDate <= endDate;
if (!inDateRange) return false;

if (selectedOfficeFilter === "all") return true;
return compareOfficeNames(v?.office, selectedOfficeFilter);
} catch {
return false;
}
});
}, [visits, dateRange, selectedOfficeFilter]);

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
const validRatings = filteredFeedbacks
.map((feedback) => normalizeFivePointRating(feedback?.averageRating))
.filter((value) => value !== null);

if (!validRatings.length) return "0.0";
const total = validRatings.reduce((sum, value) => sum + value, 0);
return (total / validRatings.length).toFixed(1);
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
const byOfficeName = offices.find(
(o) => compareOfficeNames(o.name, userOffice) || compareOfficeNames(o.officialName, userOffice)
);
if (byOfficeName) return byOfficeName;
}

if (currentUser.type === "SuperAdmin") {
return offices.find(o => o.role === "super") || null;
}

return null;
}, [currentUser, offices]);

const officialOfficeDisplayName = toOfficialOfficeDisplayName(
currentOfficeRecord?.officialName ||
currentOfficeRecord?.name ||
currentUser?.originalOffice ||
currentUser?.office ||
"",
offices
);

const printOfficeName = useMemo(() => {
const fallbackOfficeName = "Office of the College of Computing and Information Sciences";

if (!currentUser) return fallbackOfficeName;
if (currentUser.type === "SuperAdmin") {
return toOfficialOfficeDisplayName(
currentOfficeRecord?.officialName ||
currentOfficeRecord?.name ||
currentUser.originalOffice ||
currentUser.office ||
fallbackOfficeName,
offices
);
}

if (selectedOfficeFilter !== "all") return toOfficialOfficeDisplayName(selectedOfficeFilter, offices);

return toOfficialOfficeDisplayName(
currentOfficeRecord?.officialName ||
currentOfficeRecord?.name ||
currentUser.originalOffice ||
currentUser.office ||
fallbackOfficeName,
offices
);
}, [currentUser, currentOfficeRecord, selectedOfficeFilter, offices]);

const reportDateRangeLabel = useMemo(() => {
const startDate = parseLocalDate(dateRange.start);
const endDate = parseLocalDate(dateRange.end);

if (!startDate || !endDate) {
return `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`;
}

const formatMonthDay = (date) =>
date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

if (startDate.getFullYear() === endDate.getFullYear()) {
return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}, ${endDate.getFullYear()}`;
}

return `${formatMonthDay(startDate)}, ${startDate.getFullYear()} - ${formatMonthDay(endDate)}, ${endDate.getFullYear()}`;
}, [dateRange]);

const reportPeriodLabel = useMemo(() => {
const startDate = parseLocalDate(dateRange.start);
if (!startDate) return reportDateRangeLabel.toUpperCase();

const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
return `${monthName}, ${startDate.getFullYear()}`.toUpperCase();
}, [dateRange.start, reportDateRangeLabel]);

const visitsById = useMemo(() => {
const map = new Map();
visits.forEach((visit) => {
if (visit?.id) {
map.set(visit.id, visit);
}
});
return map;
}, [visits]);

const feedbackRecordsForPrint = useMemo(() => {
return filteredFeedbacks.map((feedback) => {
const matchedVisit = visitsById.get(feedback?.visitId);

return {
...feedback,
office:
matchedVisit?.office ||
feedback?.office ||
feedback?.unitOfficeVisited ||
feedback?.officeVisited ||
'Unspecified',
sex: getVisitSexValue(feedback),
clientType: getVisitClientTypeValue(feedback),
cc1Rating: getCharterRatingValue(feedback, 1) ?? getCharterRatingValue(matchedVisit, 1),
cc2Rating: getCharterRatingValue(feedback, 2) ?? getCharterRatingValue(matchedVisit, 2),
cc3Rating: getCharterRatingValue(feedback, 3) ?? getCharterRatingValue(matchedVisit, 3),
commendation: toTrimmedText(
feedback?.commendation ||
feedback?.commendations ||
feedback?.positiveFeedback ||
feedback?.compliment
),
suggestion: toTrimmedText(feedback?.suggestion || feedback?.recommendation),
questionRatings: normalizeQuestionRatings(feedback?.answers, feedback?.questions),
};
});
}, [filteredFeedbacks, visitsById]);

const officeNamesForPrint = useMemo(() => {
const officeMap = new Map();

const addOfficeName = (value) => {
if (selectedOfficeFilter !== "all" && !compareOfficeNames(value, selectedOfficeFilter)) {
return;
}
const normalized = normalizeOfficeName(value);
if (!normalized) return;
const key = normalized.toLowerCase();
if (!officeMap.has(key)) {
officeMap.set(key, normalized);
}
};

if (selectedOfficeFilter !== "all") {
addOfficeName(selectedOfficeFilter);
} else if (currentUser?.type === "OfficeAdmin") {
addOfficeName(currentUser.originalOffice || currentUser.office);
} else {
offices
.filter((office) => (office?.role || '').toLowerCase() !== 'super')
.forEach((office) => addOfficeName(office?.name || office?.officialName));
}

filteredVisits.forEach((visit) => addOfficeName(visit?.office));
feedbackRecordsForPrint.forEach((feedback) => addOfficeName(feedback?.office));

return [...officeMap.values()].sort((a, b) => a.localeCompare(b));
}, [currentUser, offices, filteredVisits, feedbackRecordsForPrint, selectedOfficeFilter]);

const officeAnalyticsRows = useMemo(() => {
return officeNamesForPrint.map((officeName) => {
const officeVisits = filteredVisits.filter((visit) =>
compareOfficeNames(visit?.office, officeName)
);

const officeFeedbacks = feedbackRecordsForPrint.filter((feedback) =>
compareOfficeNames(feedback?.office, officeName)
);

const hasVisitData = officeVisits.length > 0 || officeFeedbacks.length > 0;
const hasFeedbackData = officeFeedbacks.length > 0;

const visitMaleCount = officeVisits.filter((visit) => normalizeSex(visit?.sex) === 'M').length;
const visitFemaleCount = officeVisits.filter((visit) => normalizeSex(visit?.sex) === 'F').length;
const hasVisitSexData = visitMaleCount + visitFemaleCount > 0;

const feedbackMaleCount = officeFeedbacks.filter((feedback) => normalizeSex(feedback?.sex) === 'M').length;
const feedbackFemaleCount = officeFeedbacks.filter((feedback) => normalizeSex(feedback?.sex) === 'F').length;
const hasFeedbackSexData = feedbackMaleCount + feedbackFemaleCount > 0;

const maleCount = hasVisitSexData ? visitMaleCount : hasFeedbackSexData ? feedbackMaleCount : 0;
const femaleCount = hasVisitSexData ? visitFemaleCount : hasFeedbackSexData ? feedbackFemaleCount : 0;

const visitClientCounts = officeVisits.reduce(
(acc, visit) => {
const type = normalizeClientType(visit?.clientType);
if (type === 'citizens') acc.citizens += 1;
if (type === 'business') acc.business += 1;
if (type === 'government') acc.government += 1;
return acc;
},
{ citizens: 0, business: 0, government: 0 }
);
const hasVisitClientTypeData =
visitClientCounts.citizens + visitClientCounts.business + visitClientCounts.government > 0;

const feedbackClientCounts = officeFeedbacks.reduce(
(acc, feedback) => {
const type = normalizeClientType(feedback?.clientType);
if (type === 'citizens') acc.citizens += 1;
if (type === 'business') acc.business += 1;
if (type === 'government') acc.government += 1;
return acc;
},
{ citizens: 0, business: 0, government: 0 }
);
const hasFeedbackClientTypeData =
feedbackClientCounts.citizens +
feedbackClientCounts.business +
feedbackClientCounts.government >
0;

const clientCounts = hasVisitClientTypeData
? visitClientCounts
: hasFeedbackClientTypeData
? feedbackClientCounts
: { citizens: 0, business: 0, government: 0 };

const charterCounts = {
cc1: [0, 0, 0, 0],
cc2: [0, 0, 0, 0, 0],
cc3: [0, 0, 0, 0],
};

// Merge charter ratings per visit so missing CC fields can be filled
// from feedback/question ratings without double-counting the same visit.
const charterRatingsByVisit = new Map();

officeVisits.forEach((visit, visitIndex) => {
const key = visit?.id || `visit-${visitIndex}`;
charterRatingsByVisit.set(key, {
cc1Rating: visit?.cc1Rating ?? null,
cc2Rating: visit?.cc2Rating ?? null,
cc3Rating: visit?.cc3Rating ?? null,
});
});

officeFeedbacks.forEach((feedback, feedbackIndex) => {
const key = feedback?.visitId || feedback?.id || `feedback-${feedbackIndex}`;
const existingRatings = charterRatingsByVisit.get(key) || {
cc1Rating: null,
cc2Rating: null,
cc3Rating: null,
};

charterRatingsByVisit.set(key, {
cc1Rating:
existingRatings.cc1Rating ??
feedback?.cc1Rating ??
feedback?.questionRatings?.[0]?.rating ??
null,
cc2Rating:
existingRatings.cc2Rating ??
feedback?.cc2Rating ??
feedback?.questionRatings?.[1]?.rating ??
null,
cc3Rating:
existingRatings.cc3Rating ??
feedback?.cc3Rating ??
feedback?.questionRatings?.[2]?.rating ??
null,
});
});

let hasCharterData = false;
charterRatingsByVisit.forEach((ratings) => {
[ratings.cc1Rating, ratings.cc2Rating, ratings.cc3Rating].forEach((rating, idx) => {
const normalized = normalizeCharterRating(rating, idx);
if (!normalized) return;
charterCounts[`cc${idx + 1}`][normalized - 1] += 1;
hasCharterData = true;
});
});

const dimensionMeans = Array.from({ length: 8 }, (_, index) => {
const ratings = officeFeedbacks
.map((feedback) => normalizeFivePointRating(feedback?.questionRatings?.[index]?.rating))
.filter((value) => value !== null);

if (!ratings.length) return null;
return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
});

const meanSatisfaction = calculateMeanSatisfaction(officeFeedbacks);

const commendationSet = new Set();
const suggestionSet = new Set();

officeFeedbacks.forEach((feedback) => {
if (feedback?.commendation) {
commendationSet.add(feedback.commendation);
}
if (feedback?.suggestion) {
suggestionSet.add(feedback.suggestion);
}
});

return {
office: officeName,
hasVisitData,
hasFeedbackData,
customerCount: officeVisits.length > 0 ? officeVisits.length : officeFeedbacks.length,
maleCount,
femaleCount,
citizensCount: clientCounts.citizens,
businessCount: clientCounts.business,
governmentCount: clientCounts.government,
hasCharterData,
cc1Counts: charterCounts.cc1,
cc2Counts: charterCounts.cc2,
cc3Counts: charterCounts.cc3,
dimensionMeans,
meanSatisfaction,
satisfactionDescription: getSatisfactionDescription(meanSatisfaction),
commendations: [...commendationSet],
suggestions: [...suggestionSet],
};
});
}, [officeNamesForPrint, filteredVisits, feedbackRecordsForPrint]);

const officeConcernedNameForPrint = useMemo(() => {
const sourceOfficeName =
selectedOfficeFilter !== "all"
? selectedOfficeFilter
: officeAnalyticsRows[0]?.office ||
currentOfficeRecord?.name ||
currentUser?.originalOffice ||
currentUser?.office ||
"";

const matchedOffice = findOfficeRecordByName(sourceOfficeName, offices);

return (
normalizeOfficeName(matchedOffice?.name) ||
normalizeOfficeName(sourceOfficeName) ||
normalizeOfficeName(currentOfficeRecord?.name) ||
normalizeOfficeName(currentUser?.originalOffice) ||
normalizeOfficeName(currentUser?.office) ||
"N/A"
);
}, [selectedOfficeFilter, officeAnalyticsRows, currentOfficeRecord, currentUser, offices]);

const charterOverallTotals = useMemo(() => {
const totals = {
customerCount: 0,
maleCount: 0,
femaleCount: 0,
citizensCount: 0,
businessCount: 0,
governmentCount: 0,
cc1Counts: [0, 0, 0, 0],
cc2Counts: [0, 0, 0, 0, 0],
cc3Counts: [0, 0, 0, 0],
};

officeAnalyticsRows.forEach((row) => {
totals.customerCount += row.customerCount;
totals.maleCount += row.maleCount;
totals.femaleCount += row.femaleCount;
totals.citizensCount += row.citizensCount;
totals.businessCount += row.businessCount;
totals.governmentCount += row.governmentCount;

[0, 1, 2, 3].forEach((index) => {
totals.cc1Counts[index] += row.cc1Counts[index];
totals.cc3Counts[index] += row.cc3Counts[index];
});

[0, 1, 2, 3, 4].forEach((index) => {
totals.cc2Counts[index] += row.cc2Counts[index];
});
});

return totals;
}, [officeAnalyticsRows]);

const summaryOverallRow = useMemo(() => {
const rowsWithFeedback = officeAnalyticsRows.filter((row) => row.hasFeedbackData);

const averageValues = (values = []) => {
const numericValues = values.filter(
(value) => value !== null && value !== undefined && !Number.isNaN(value)
);
if (!numericValues.length) return null;
return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

const dimensionMeans = Array.from({ length: 8 }, (_, index) =>
averageValues(rowsWithFeedback.map((row) => row.dimensionMeans[index]))
);

const meanSatisfaction = averageValues(rowsWithFeedback.map((row) => row.meanSatisfaction));

return {
customerCount: filteredVisits.length,
dimensionMeans,
meanSatisfaction,
satisfactionDescription: getSatisfactionDescription(meanSatisfaction),
};
}, [officeAnalyticsRows, filteredVisits.length]);

const commendationSuggestionRows = useMemo(() => {
return officeAnalyticsRows.filter(
(row) => row.commendations.length > 0 || row.suggestions.length > 0
);
}, [officeAnalyticsRows]);

const csfRowsForPrint = useMemo(() => {
if (commendationSuggestionRows.length) return commendationSuggestionRows;

return [
{
office: 'N/A',
commendations: [],
suggestions: [],
},
];
}, [commendationSuggestionRows]);

const isSingleOffice = officeAnalyticsRows.length === 1;

const charterRowsForPrint = useMemo(() => {
if (isSingleOffice) {
return officeAnalyticsRows.map((row) => ({ kind: 'office', row }));
}

return [
...officeAnalyticsRows.map((row) => ({ kind: 'office', row })),
{ kind: 'overall', row: charterOverallTotals },
];
}, [officeAnalyticsRows, charterOverallTotals, isSingleOffice]);

const summaryRowsForPrint = useMemo(() => {
if (isSingleOffice) {
return officeAnalyticsRows.map((row) => ({ kind: 'office', row }));
}

return [
...officeAnalyticsRows.map((row) => ({ kind: 'office', row })),
{ kind: 'overall', row: summaryOverallRow },
];
}, [officeAnalyticsRows, summaryOverallRow, isSingleOffice]);

const preparedByNameForPrint =
toTrimmedText(printSignatories.prepared) || "________________________";
const verifiedByNameForPrint =
toTrimmedText(printSignatories.verified) || "________________________";
const approvedByNameForPrint =
toTrimmedText(printSignatories.approved) || "________________________";

// --- Export Functions ---
const exportToPDF = () => {
setShowPrintSignatoryModal(true);
};

const handleConfirmPrint = () => {
setShowPrintSignatoryModal(false);

try {
setTimeout(() => {
window.print();
}, 0);
} catch (error) {
console.error('Error printing:', error);
alert('Failed to print. Please try again.');
}
};

const renderNarrativeText = (text) => {
return text
.split(/(\*\*[^*]+\*\*)/g)
.filter(Boolean)
.map((segment, index) => {
if (segment.startsWith('**') && segment.endsWith('**')) {
return (
<strong key={`bold-${index}`}>
{segment.slice(2, -2)}
</strong>
);
}

return (
<React.Fragment key={`text-${index}`}>
{segment}
</React.Fragment>
);
});
};

// Generate integrated narrative
const generateIntegratedNarrative = () => {
const officeContext =
currentUser && currentUser.type === "OfficeAdmin"
? `the ${currentUser.originalOffice || currentUser.office} office`
: "our facility";

const ratings = filteredFeedbacks
.map((feedback) => getNumericRating(feedback?.averageRating))
.filter((rating) => rating !== null);

const highSatCount = ratings.filter((rating) => rating >= 4).length;
const midSatCount = ratings.filter((rating) => rating >= 2 && rating < 4).length;
const lowSatCount = ratings.filter((rating) => rating < 2).length;

let narrative =
`During the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, ` +
`${officeContext} recorded ${filteredVisits.length} visitor check-in${filteredVisits.length !== 1 ? 's' : ''} with ` +
`${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''}.`;

if (filteredFeedbacks.length === 0) {
narrative += ` No feedback ratings were submitted during this date range, so only visitor volume insights are available.`;
return narrative;
}

narrative += ` The average satisfaction rating was ${avgSatisfaction} out of 5.`;

if (highSatCount > 0) {
narrative += ` ${highSatCount} response${highSatCount !== 1 ? 's' : ''} reflected high satisfaction (4.0+).`;
}

if (midSatCount > 0) {
narrative += ` ${midSatCount} response${midSatCount !== 1 ? 's' : ''} landed in the mid-range (2.0-3.9), indicating opportunities to improve consistency.`;
}

if (lowSatCount > 0) {
narrative += ` ${lowSatCount} response${lowSatCount !== 1 ? 's' : ''} signaled dissatisfaction (below 2.0) and should be prioritized.`;
}

const feedbacksWithComments = feedbacksWithVisitDetails.filter(
(feedback) =>
feedback.comment &&
feedback.comment.trim() !== '' &&
feedback.comment !== 'No comment provided'
);

if (!feedbacksWithComments.length) {
narrative += `\n\nNo written comments were submitted, so qualitative insight is currently limited.`;
return narrative;
}

narrative += `\n\nKey observations from written feedback:\n\n`;

feedbacksWithComments.slice(0, 8).forEach((feedback, idx) => {
const numericRating = getNumericRating(feedback?.averageRating);
const ratingText = numericRating !== null ? `${numericRating.toFixed(1)}/5` : 'N/A';
const cleanedComment = feedback.comment.replace(/\s+/g, ' ').trim();
narrative += `${idx + 1}. ${feedback.visitorName}` +
`${currentUser && currentUser.type === "SuperAdmin" ? ` from ${feedback.visitorOffice || 'Unknown Office'}` : ''}` +
` rated their experience ${ratingText}: "${cleanedComment}"\n\n`;
});

if (feedbacksWithComments.length > 8) {
narrative += `Additional written feedback entries are available in the Feedback Insights panel.\n`;
}

return narrative.trim();
};

// Generate overall analytics narrative
const generateOverallNarrative = () => {
const reportScope =
currentUser && currentUser.type === "OfficeAdmin"
? `for the ${currentUser.originalOffice || currentUser.office} office`
: 'for all monitored offices';

const ratings = filteredFeedbacks
.map((feedback) => getNumericRating(feedback?.averageRating))
.filter((rating) => rating !== null && rating >= 0 && rating <= 5);

const totalRatedFeedback = ratings.length;
const verySatisfied = satisfactionRates.find((rate) => rate.label === 'Very Satisfied');
const satisfied = satisfactionRates.find((rate) => rate.label === 'Satisfied');
const neutral = satisfactionRates.find((rate) => rate.label === 'Neither Satisfied nor Dissatisfied');
const unsatisfied = satisfactionRates.find((rate) => rate.label === 'Unsatisfied');
const veryUnsatisfied = satisfactionRates.find((rate) => rate.label === 'Very Unsatisfied');

const positivePct = (verySatisfied?.pct || 0) + (satisfied?.pct || 0);
const neutralPct = neutral?.pct || 0;
const negativePct = (unsatisfied?.pct || 0) + (veryUnsatisfied?.pct || 0);
const feedbackResponseRate =
filteredVisits.length > 0
? Math.round((filteredFeedbacks.length / filteredVisits.length) * 100)
: 0;

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const totalVisits = trafficData.reduce((sum, day) => sum + day.count, 0);
const maxTrafficCount = totalVisits > 0 ? Math.max(...trafficData.map((day) => day.count)) : 0;
const minTrafficCount = totalVisits > 0 ? Math.min(...trafficData.map((day) => day.count)) : 0;

const peakDays = trafficData
.map((day, index) => ({ ...day, name: daysOfWeek[index] }))
.filter((day) => day.count === maxTrafficCount && maxTrafficCount > 0)
.map((day) => day.name);

const lowDays = trafficData
.map((day, index) => ({ ...day, name: daysOfWeek[index] }))
.filter((day) => day.count === minTrafficCount)
.map((day) => day.name);

const weekdayTotal = trafficData.slice(0, 5).reduce((sum, day) => sum + day.count, 0);
const weekendTotal = trafficData.slice(5, 7).reduce((sum, day) => sum + day.count, 0);
const weekdayPct = totalVisits > 0 ? Math.round((weekdayTotal / totalVisits) * 100) : 0;
const weekendPct = totalVisits > 0 ? Math.round((weekendTotal / totalVisits) * 100) : 0;

const feedbacksWithComments = feedbacksWithVisitDetails.filter(
(feedback) =>
feedback.comment &&
feedback.comment.trim() !== '' &&
feedback.comment !== 'No comment provided'
);

const highSatCount = ratings.filter((rating) => rating >= 4).length;
const lowSatCount = ratings.filter((rating) => rating < 2).length;
const highSatPct = totalRatedFeedback > 0 ? Math.round((highSatCount / totalRatedFeedback) * 100) : 0;
const lowSatPct = totalRatedFeedback > 0 ? Math.round((lowSatCount / totalRatedFeedback) * 100) : 0;

const recommendations = [];

if (filteredVisits.length === 0) {
recommendations.push('Promote visitation by reviewing office accessibility and improving check-in awareness.');
}

if (filteredVisits.length > 0 && filteredFeedbacks.length === 0) {
recommendations.push('Increase feedback capture by reminding visitors to complete the CSF after each transaction.');
}

if (negativePct > 20) {
recommendations.push(`Prioritize service recovery actions because ${negativePct}% of responses show dissatisfaction.`);
}

if (neutralPct > 25) {
recommendations.push(`Address the ${neutralPct}% neutral responses through queue-time and process-quality improvements.`);
}

if (totalVisits > 0 && maxTrafficCount > Math.max(1, minTrafficCount) * 2) {
recommendations.push('Rebalance staffing and support resources between peak and low-traffic days.');
}

if (totalRatedFeedback > 0 && positivePct >= 70) {
recommendations.push(`Sustain current best practices while targeting remaining gaps to protect the ${positivePct}% positive rating base.`);
}

if (recommendations.length === 0) {
recommendations.push('Maintain current service standards and continue monthly monitoring of traffic and satisfaction indicators.');
}

const narrativeLines = [
'# Executive Summary',
'',
`This comprehensive analytics report covers the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)} ${reportScope}, providing insights into visitor traffic patterns, satisfaction rates, and feedback quality.`,
'',
'## Overview',
'',
];

if (filteredVisits.length === 0 && filteredFeedbacks.length === 0) {
narrativeLines.push('No visitor check-ins or feedback submissions were recorded during this reporting period.');
} else {
narrativeLines.push(
`During this reporting period, ${currentUser && currentUser.type === "OfficeAdmin" ? `the ${currentUser.originalOffice || currentUser.office} office` : 'all tracked offices'} logged ` +
`${filteredVisits.length} visitor check-in${filteredVisits.length !== 1 ? 's' : ''} and ${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''}.`
);

if (totalRatedFeedback > 0) {
narrativeLines.push(
`The overall average satisfaction rating was ${avgSatisfaction} out of 5.0, representing ` +
`${parseFloat(avgSatisfaction) >= 4 ? 'strong' : parseFloat(avgSatisfaction) >= 3 ? 'moderate' : 'developing'} service performance.`
);
} else if (filteredFeedbacks.length > 0) {
narrativeLines.push('Feedback exists but no valid numeric satisfaction scores were found for this period.');
}

if (filteredVisits.length > 0) {
narrativeLines.push(
`The feedback response rate was ${feedbackResponseRate}% (${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''} out of ${filteredVisits.length} visit${filteredVisits.length !== 1 ? 's' : ''}).`
);
}
}

narrativeLines.push('', '## Visitor Traffic Analysis', '');

if (totalVisits === 0) {
narrativeLines.push('No visitor traffic was recorded during the selected date range.');
} else {
narrativeLines.push(`A total of ${totalVisits} visitor check-in${totalVisits !== 1 ? 's' : ''} was recorded across the week.`);
narrativeLines.push(
`${formatNameList(peakDays)} ${peakDays.length === 1 ? 'was' : 'were'} the busiest day${peakDays.length === 1 ? '' : 's'} with ${maxTrafficCount} check-in${maxTrafficCount !== 1 ? 's' : ''}.`
);

if (minTrafficCount === 0) {
narrativeLines.push(`${formatNameList(lowDays)} registered no visitor activity.`);
} else if (minTrafficCount < maxTrafficCount) {
narrativeLines.push(
`${formatNameList(lowDays)} ${lowDays.length === 1 ? 'had' : 'had'} the lowest activity with ${minTrafficCount} check-in${minTrafficCount !== 1 ? 's' : ''}.`
);
}

narrativeLines.push(
`Weekday visits accounted for ${weekdayPct}% of total traffic, while weekend visits accounted for ${weekendPct}%.`
);
}

narrativeLines.push('', '## Satisfaction Rate Analysis', '');

if (totalRatedFeedback === 0) {
narrativeLines.push('No valid satisfaction ratings were submitted during this reporting period.');
} else {
narrativeLines.push(
`From ${totalRatedFeedback} rated feedback response${totalRatedFeedback !== 1 ? 's' : ''}, ${positivePct}% were positive, ${neutralPct}% were neutral, and ${negativePct}% were negative.`
);
narrativeLines.push('', 'Breaking down the satisfaction categories:');

satisfactionRates.forEach((rate) => {
const count = Math.round((rate.pct / 100) * totalRatedFeedback);
narrativeLines.push(`- ${rate.label}: ${rate.pct}% (${count} feedback${count !== 1 ? 's' : ''})`);
});
}

narrativeLines.push('', '## Key Insights from Feedback', '');

if (filteredFeedbacks.length === 0) {
narrativeLines.push('No feedback submissions were recorded, so qualitative analysis is limited for this period.');
} else {
narrativeLines.push(
`**Positive Highlights:** ${highSatCount} response${highSatCount !== 1 ? 's' : ''} scored 4.0 and above` +
`${totalRatedFeedback > 0 ? ` (${highSatPct}% of rated feedback).` : '.'}`
);

if (lowSatCount > 0) {
narrativeLines.push(
`**Areas for Improvement:** ${lowSatCount} response${lowSatCount !== 1 ? 's' : ''} scored below 2.0` +
`${totalRatedFeedback > 0 ? ` (${lowSatPct}% of rated feedback).` : '.'}`
);
} else {
narrativeLines.push('**Areas for Improvement:** No responses were rated below 2.0, indicating no severe dissatisfaction in this period.');
}

if (feedbacksWithComments.length > 0) {
const sampleComments = feedbacksWithComments
.slice(0, 3)
.map((feedback) => feedback.comment.replace(/\s+/g, ' ').trim())
.filter(Boolean);

narrativeLines.push(
`**Written Feedback Summary:** ${feedbacksWithComments.length} of ${filteredFeedbacks.length} feedback response${filteredFeedbacks.length !== 1 ? 's' : ''} included written comments.`
);

if (sampleComments.length > 0) {
narrativeLines.push('**Sample Comment Themes:**');
sampleComments.forEach((comment) => {
narrativeLines.push(`- ${comment}`);
});
}
} else {
narrativeLines.push('**Written Feedback Summary:** No written comments were submitted in this reporting period.');
}
}

narrativeLines.push('', '## Recommendations', '');
recommendations.forEach((item) => {
narrativeLines.push(`- ${item}`);
});

narrativeLines.push('', '## Conclusion', '');

if (filteredVisits.length === 0 && filteredFeedbacks.length === 0) {
narrativeLines.push('This reporting window has insufficient activity to establish performance trends. Continued data capture is needed for a more reliable integration analysis.');
} else if (totalRatedFeedback === 0) {
narrativeLines.push('Operational activity is present, but satisfaction conclusions remain limited until more rated feedback is collected.');
} else {
narrativeLines.push(
`This reporting period demonstrates ${parseFloat(avgSatisfaction) >= 4 ? 'strong visitor engagement and satisfaction' : parseFloat(avgSatisfaction) >= 3 ? 'steady engagement with room for enhancement' : 'developing engagement requiring focused improvements'}.` +
' Continued monitoring of traffic and satisfaction patterns will support data-driven service improvements.'
);
}

return narrativeLines.join('\n');
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
Loading data for {officialOfficeDisplayName}...
</p>
)}
</div>
</div>
);
}

const PRINT_PAGE_WIDTH_IN = 13;
const PRINT_PAGE_HEIGHT_IN = 8.5;
const PRINT_PAGE_MARGIN_CM = 1.27;
const PRINT_MARGIN_TOTAL_CM = PRINT_PAGE_MARGIN_CM * 2;

return (
<div className="min-h-screen bg-gray-50 font-sans text-slate-800">
<style>{`
      @media print {
        body * {
          visibility: hidden;
        }
        .print-only-section,
        .print-only-section * {
          visibility: visible;
        }
        .print-only-section {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          background: #fff;
          margin: 0;
          padding: 0;
        }

        .print-section {
          display: block !important;
        }
        .no-print {
          display: none !important;
        }
        @page {
          size: ${PRINT_PAGE_WIDTH_IN}in ${PRINT_PAGE_HEIGHT_IN}in;
          margin: ${PRINT_PAGE_MARGIN_CM}cm;
        }

        html,
        body {
          margin: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-wrapper {
          padding: 10px 14px;
          font-family: "Times New Roman", Times, serif;
          color: #111;
          width: 100%;
          max-width: calc(${PRINT_PAGE_WIDTH_IN}in - ${PRINT_MARGIN_TOTAL_CM}cm);
          box-sizing: border-box;
          border-collapse: collapse;
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

         .print-header-meta {
           display: flex;
           justify-content: space-between;
           margin-top: 8px;
           margin-bottom: 8px;
           font-family: Arial, sans-serif;
           font-size: 14.67px;
           font-weight: 400;
         }

         .print-header-meta p {
           margin: 0;
         }

        .analytics-report-title {
          font-size: 16px;
          text-align: center;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .analytics-section-label {
          font-size: 12px;
          font-weight: 700;
          break-after: avoid-page;
          page-break-after: avoid;
        }

        .analytics-table {
          width: 100%;
          table-layout: fixed;
          page-break-inside: auto;
          break-inside: auto;
        }

        .analytics-table th,
        .analytics-table td {
          border: 1px solid #000 !important;
          vertical-align: top;
        }

        .analytics-table th {
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          padding: 3px 2px;
          vertical-align: middle;
          font-family: Arial, sans-serif;
          word-break: break-word;
        }

        .analytics-table td {
          font-size: 12px;
          line-height: 1.2;
          padding: 2px 2px;
          text-align: center;
          font-family: Arial, sans-serif;
          word-break: break-word;
          white-space: normal;
        }

        .analytics-table-a td:first-child,
        .analytics-table-b td:first-child,
        .analytics-table-c td:first-child {
          text-align: center;
        }

        .analytics-table-c td {
          text-align: left;
        }

        .analytics-table-c td.text-center {
          text-align: center;
        }

        .analytics-table tr {
          page-break-inside: avoid;
          break-inside: avoid;
          page-break-after: auto;
        }

        .analytics-table-c tr {
          page-break-inside: avoid;
        }

        .analytics-table ul {
          margin: 0;
          padding-left: 14px;
        }

        .analytics-table li {
          margin-bottom: 3px;
        }

        .analytics-signatories {
          margin-top: 24px;
          font-size: 16px;
           page-break-inside: avoid;
           break-inside: avoid;
         }

         .analytics-signatories-row,
         .analytics-signatory-group {
           page-break-inside: avoid;
           break-inside: avoid;
         }

         .analytics-signatory-name {
           white-space: nowrap;
        }

        .analytics-table thead {
          display: table-row-group !important;
        }

        .analytics-table tfoot {
          display: table-footer-group;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>

<main className="flex flex-col print-section">
{/* Print-Only Summary */}
<div className="hidden print:block bg-white print-only-section text-black">
{(() => {
const renderHeader = () => (
<div className="flex items-start justify-between mb-4 gap-4">
<div className="flex items-start gap-3">
<div className="w-20 h-16 flex items-center justify-center">
<img src={bisuLogo} alt="BISU Logo" className="w-full h-full object-contain" />
</div>
<div className="leading-tight text-left">
<p className="text-[14.67px]" style={{ fontFamily: "Arial, sans-serif" }}>Republic of the Philippines</p>
<h1 className="text-[16px] font-bold tracking-wide leading-none" style={{ fontFamily: "Arial, sans-serif" }}>BOHOL ISLAND STATE UNIVERSITY</h1>
<p className="text-[13.33px]" style={{ fontFamily: "Arial, sans-serif" }}>Magsija, Balilihan 6342, Bohol, Philippines</p>
<p className="text-[13.33px]" style={{ fontFamily: "Arial, sans-serif" }}>{printOfficeName}</p>
<p className="text-[13.33px] italic" style={{ fontFamily: "\"Times New Roman\", Times, serif" }}>Balance | Integrity | Stewardship | Uprightness</p>
</div>
</div>

<div className="flex gap-3 items-start">
<div className="w-20 h-14 flex items-center justify-center">
<img
src={bagongPilipinasLogo}
alt="Bagong Pilipinas Logo"
className="w-full h-full object-contain"
/>
</div>
<div className="w-28 h-14 flex items-center justify-center">
<img src={tuvISOLogo} alt="ISO 9001:2015 Certification" className="w-full h-full object-contain" />
</div>
</div>
</div>
);

const renderList = (items = []) => {
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
const renderSignatories = () => (
<div className="analytics-signatories" style={{ fontFamily: "Arial, sans-serif", fontSize: "16px" }}>
<div className="analytics-signatories-row grid grid-cols-2 gap-24 mb-6">
<div className="analytics-signatory-group text-center">
<p className="text-left mb-3">Prepared:</p>
<p className="font-semibold underline analytics-signatory-name">{preparedByNameForPrint}</p>
<p>Administrative Aide VI</p>
</div>

<div className="analytics-signatory-group text-center">
<p className="text-left mb-3">Verified:</p>
<p className="font-semibold underline analytics-signatory-name">{verifiedByNameForPrint}</p>
<p>Human Resource Management Officer II</p>
</div>
</div>

<div className="analytics-signatory-group max-w-md mx-auto text-center">
<p className="mb-3 text-left pl-8">Approved:</p>
<p className="font-semibold underline analytics-signatory-name">{approvedByNameForPrint}</p>
<p>Campus Director</p>
</div>
</div>
);

const renderCsfTable = (rows, pageKey, showHeader = true) => {
const placeholderText = showHeader ? 'N/A' : '';

return (
<table className="w-full border-collapse analytics-table analytics-table-c">
<colgroup>
<col style={{ width: '16%' }} />
<col style={{ width: '18%' }} />
<col style={{ width: '18%' }} />
<col style={{ width: '7%' }} />
<col style={{ width: '8%' }} />
<col style={{ width: '9%' }} />
<col style={{ width: '8%' }} />
<col style={{ width: '8%' }} />
<col style={{ width: '8%' }} />
</colgroup>
{showHeader && (
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
<th className="w-[8%]">Implementation (Closed)</th>
<th className="w-[8%]">On-going / To be Implemented (Open)</th>
<th className="w-[8%]">Not Implemented</th>
</tr>
</thead>
)}
<tbody>
{rows.map((row, rowIndex) => (
<tr key={`csf-row-${pageKey}-${row.office}-${rowIndex}`}>
<td>{row.office}</td>
<td>{renderList(row.commendations)}</td>
<td>{renderList(row.suggestions)}</td>
<td className="text-center">{placeholderText}</td>
<td className="text-center">{placeholderText}</td>
<td className="text-center">{placeholderText}</td>
<td className="text-center">{placeholderText}</td>
<td className="text-center">{placeholderText}</td>
<td className="text-center">{placeholderText}</td>
</tr>
))}
</tbody>
</table>
);
};

const renderCharterTable = (entries, pageKey, showHeader = true) => (
<table className="w-full border-collapse analytics-table analytics-table-a">
<colgroup>
{!isSingleOffice && <col style={{ width: '18%' }} />}
<col style={{ width: isSingleOffice ? '8%' : '6%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
<col style={{ width: '4%' }} />
</colgroup>
{showHeader && (
<thead>
<tr>
{!isSingleOffice && <th rowSpan={2} className="w-[18%]">Office</th>}
<th rowSpan={2} className={isSingleOffice ? "w-[8%]" : "w-[6%]"}>Number of Customers(f)</th>
<th colSpan={2} className="w-[8%]">Sex</th>
<th colSpan={3} className="w-[12%]">Client Type</th>
<th colSpan={4} className="w-[16%]">CC1</th>
<th colSpan={5} className="w-[20%]">CC2</th>
<th colSpan={4} className="w-[16%]">CC3</th>
</tr>
<tr>
<th>M</th>
<th>F</th>
<th>Citizens</th>
<th>Business</th>
<th>Government</th>
<th>CC 1-1</th>
<th>CC 1-2</th>
<th>CC 1-3</th>
<th>CC 1-4</th>
<th>CC 2-1</th>
<th>CC 2-2</th>
<th>CC 2-3</th>
<th>CC 2-4</th>
<th>CC 2-5</th>
<th>CC 3-1</th>
<th>CC 3-2</th>
<th>CC 3-3</th>
<th>CC 3-4</th>
</tr>
</thead>
)}
<tbody>
{entries.map((entry, rowIndex) => {
if (entry.kind === 'overall') {
return (
<tr key={`charter-overall-${pageKey}-${rowIndex}`} className="font-bold">
{!isSingleOffice && <td>Overall Rating</td>}
<td>{charterOverallTotals.customerCount}</td>
<td>{charterOverallTotals.maleCount}</td>
<td>{charterOverallTotals.femaleCount}</td>
<td>{charterOverallTotals.citizensCount}</td>
<td>{charterOverallTotals.businessCount}</td>
<td>{charterOverallTotals.governmentCount}</td>
<td>{charterOverallTotals.cc1Counts[0]}</td>
<td>{charterOverallTotals.cc1Counts[1]}</td>
<td>{charterOverallTotals.cc1Counts[2]}</td>
<td>{charterOverallTotals.cc1Counts[3]}</td>
<td>{charterOverallTotals.cc2Counts[0]}</td>
<td>{charterOverallTotals.cc2Counts[1]}</td>
<td>{charterOverallTotals.cc2Counts[2]}</td>
<td>{charterOverallTotals.cc2Counts[3]}</td>
<td>{charterOverallTotals.cc2Counts[4]}</td>
<td>{charterOverallTotals.cc3Counts[0]}</td>
<td>{charterOverallTotals.cc3Counts[1]}</td>
<td>{charterOverallTotals.cc3Counts[2]}</td>
<td>{charterOverallTotals.cc3Counts[3]}</td>
</tr>
);
}

const row = entry.row;
return (
<tr key={`charter-row-${pageKey}-${row.office}-${rowIndex}`}>
{!isSingleOffice && <td>{row.office}</td>}
<td>{formatCountCell(row.customerCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.maleCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.femaleCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.citizensCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.businessCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.governmentCount, row.hasVisitData)}</td>
<td>{formatCountCell(row.cc1Counts[0], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc1Counts[1], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc1Counts[2], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc1Counts[3], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc2Counts[0], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc2Counts[1], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc2Counts[2], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc2Counts[3], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc2Counts[4], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc3Counts[0], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc3Counts[1], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc3Counts[2], row.hasCharterData)}</td>
<td>{formatCountCell(row.cc3Counts[3], row.hasCharterData)}</td>
</tr>
);
})}
</tbody>
</table>
);

const renderSummaryTable = (entries, pageKey, showHeader = true) => (
<table className="w-full border-collapse analytics-table analytics-table-b">
<colgroup>
{!isSingleOffice && <col style={{ width: '18%' }} />}
<col style={{ width: isSingleOffice ? '8%' : '6%' }} />
<col style={{ width: '7%' }} />
<col style={{ width: '7%' }} />
<col style={{ width: '7%' }} />
<col style={{ width: '7%' }} />
<col style={{ width: '6%' }} />
<col style={{ width: '6%' }} />
<col style={{ width: '6%' }} />
<col style={{ width: '6%' }} />
<col style={{ width: '6%' }} />
<col style={{ width: '8%' }} />
</colgroup>
{showHeader && (
<thead>
<tr>
{!isSingleOffice && <th className="w-[18%]">Office</th>}
<th className={isSingleOffice ? "w-[8%]" : "w-[6%]"}>Number of Customer rs(f)</th>
<th className="w-[7%]">Responsiveness</th>
<th className="w-[7%]">Reliability (Quality)</th>
<th className="w-[7%]">Access &amp; Facilities</th>
<th className="w-[7%]">Communication</th>
<th className="w-[6%]">Costs</th>
<th className="w-[6%]">Integrity</th>
<th className="w-[6%]">Assurance</th>
<th className="w-[6%]">Outcome</th>
<th className="w-[6%]">Mean Satisfaction</th>
<th className="w-[8%]">Description</th>
</tr>
</thead>
)}
<tbody>
{entries.map((entry, rowIndex) => {
if (entry.kind === 'overall') {
return (
<tr key={`summary-overall-${pageKey}-${rowIndex}`} className="font-bold">
{!isSingleOffice && <td>Overall Rating</td>}
<td>{summaryOverallRow.customerCount}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[0])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[1])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[2])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[3])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[4])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[5])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[6])}</td>
<td>{formatScoreCell(summaryOverallRow.dimensionMeans[7])}</td>
<td>{formatScoreCell(summaryOverallRow.meanSatisfaction)}</td>
<td>{summaryOverallRow.satisfactionDescription}</td>
</tr>
);
}

const row = entry.row;
return (
<tr key={`summary-row-${pageKey}-${row.office}-${rowIndex}`}>
{!isSingleOffice && <td>{row.office}</td>}
<td>{formatCountCell(row.customerCount, row.hasVisitData)}</td>
<td>{formatScoreCell(row.dimensionMeans[0])}</td>
<td>{formatScoreCell(row.dimensionMeans[1])}</td>
<td>{formatScoreCell(row.dimensionMeans[2])}</td>
<td>{formatScoreCell(row.dimensionMeans[3])}</td>
<td>{formatScoreCell(row.dimensionMeans[4])}</td>
<td>{formatScoreCell(row.dimensionMeans[5])}</td>
<td>{formatScoreCell(row.dimensionMeans[6])}</td>
<td>{formatScoreCell(row.dimensionMeans[7])}</td>
<td>{formatScoreCell(row.meanSatisfaction)}</td>
<td>{row.satisfactionDescription}</td>
</tr>
);
})}
</tbody>
</table>
);

return (
<table className="print-wrapper w-full border-collapse">
<thead>
<tr>
<th colSpan={20}>
{renderHeader()}
</th>
</tr>
<tr>
<th colSpan={20}>
{isSingleOffice ? (
<>
<h2
className="analytics-report-title font-Arial"
style={{ fontFamily: "Arial, sans-serif", fontSize: "21.33px" }}
>
MONTHLY REPORT CARD
</h2>
<div
className="flex justify-between mt-3 mb-4"
style={{ fontFamily: "Arial, sans-serif", fontSize: "14.67px" }}
>
            <p className="font-normal">
              Office Concerned :
              <span className="underline ml-2">
                {officeConcernedNameForPrint}
              </span>
            </p>
            <p className="font-normal">
              Month :
              <span className="underline ml-2">{reportPeriodLabel}</span>
            </p>
</div>
</>
) : (
<h2
className="analytics-report-title font-Arial"
style={{ fontFamily: "Arial, sans-serif" }}
>
MONTHLY CUSTOMER SATISFACTION SUMMARY FORM - <span className="underline">{reportPeriodLabel}</span>
</h2>
)}
</th>
</tr>
</thead>
<tbody>
<tr>
<td>
                      
<div className="mt-4">
<div className={`flex items-center mb-2 ${isSingleOffice ? "justify-start" : "justify-between"}`}>
<p className="analytics-section-label" style={{ fontSize: "12px", fontFamily: "Arial, sans-serif" }}>
A. Citizen&apos;s Charter Summary Result
</p>
{!isSingleOffice && (
<p className="analytics-section-label" style={{ fontSize: "12px", fontFamily: "Arial, sans-serif" }}>
Campus: <span className="underline">Balilihan Campus</span>
</p>
)}
</div>
{renderCharterTable(charterRowsForPrint, 'section-a', true)}
</div>

</td>
</tr>
<tr>
<td>
<div className="mt-6">
<p className="analytics-section-label mb-2" style={{ fontSize: "12px", fontFamily: "Arial, sans-serif" }}>
B. CSF Monthly Summary Rating
</p>
{renderSummaryTable(summaryRowsForPrint, 'section-b', true)}
</div>

</td>
</tr>
<tr>
<td>
<div className="mt-6">
<p className="analytics-section-label mb-2" style={{ fontSize: "12px", fontFamily: "Arial, sans-serif" }}>
C.
<span style={{ fontFamily: "Arial, sans-serif" }}>
{' '}CSF Monthly Commendations &amp; Suggestions
</span>
</p>
{renderCsfTable(csfRowsForPrint, 'section-c', true)}
</div>
</td>
</tr>
</tbody>
<tfoot>
<tr>
<td colSpan={20}>{renderSignatories()}</td>
</tr>
</tfoot>
</table>
);
})()}
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
{officialOfficeDisplayName} Office
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

<div className="flex flex-wrap justify-start sm:justify-end items-center gap-2.5 no-print">
{/* <div className="relative">
                 <button 
                   onClick={() => setShowOverallModal(true)}
                   className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white rounded-lg shadow-lg hover:shadow-xl transition-all text-sm font-medium"
                 >
                   <BarChart2 size={18} />
                   <span>Overall Integration</span>
                 </button>
               </div> */}

<div className="relative">
<button
onClick={exportToPDF}
className="h-[46px] inline-flex items-center gap-2 px-4 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-shadow text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
>
<Printer size={18} className="text-gray-600" />
<span>Print Report</span>
</button>
</div>

{currentUser?.type === "SuperAdmin" && (
<div className="relative w-[170px]">
<select
className="h-[46px] w-full border border-gray-300 rounded-xl px-4 text-sm bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
value={selectedOfficeFilter}
onChange={(e) => setSelectedOfficeFilter(e.target.value)}
>
<option value="all">All Offices</option>
{officeFilterOptions.map((officeName) => (
<option key={`office-filter-${officeName}`} value={officeName}>
{officeName}
</option>
))}
</select>
</div>
)}

<div className="relative w-[260px] sm:w-[280px]" ref={dayRangeDropdownRef}>
<button
type="button"
onClick={() => {
if (!showDayRangeDropdown) {
setPendingDayRange({
start: dateRange.start,
end: dateRange.end,
});
}
setShowDayRangeDropdown((prev) => !prev);
}}
className="h-[46px] w-full border border-gray-300 rounded-xl px-4 bg-white text-gray-800 shadow-sm flex items-center justify-between hover:bg-gray-50"
>
<span className="inline-flex items-center gap-2 text-sm font-medium min-w-0">
<Calendar size={16} className="text-gray-600" />
<span className="truncate">{dateRangeDropdownLabel}</span>
</span>
<ChevronDown
size={16}
className={`text-gray-600 transition-transform ${
                       showDayRangeDropdown ? "rotate-180" : ""
                     }`}
/>
</button>

{showDayRangeDropdown && (
<div className="absolute right-0 top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
<div className="space-y-3">
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">Range Type</label>
<select
className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
value={dateRangeMode}
onChange={(e) => handleDateRangeModeChange(e.target.value)}
>
<option value="month">Month</option>
<option value="day">Day</option>
</select>
</div>

{dateRangeMode === "month" ? (
<>
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
<input
type="month"
className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
value={monthRange.start}
onChange={(e) => handleMonthRangeChange(e.target.value)}
/>
</div>

<button
type="button"
onClick={applyMonthRangeSelection}
className="w-full bg-[#6B46C1] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#5B34B8] transition-colors"
>
Apply
</button>
</>
) : (
<>
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
<input
type="date"
className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
value={pendingDayRange.start}
max={pendingDayRange.end || undefined}
onChange={(e) => handleDayRangeChange("start", e.target.value)}
/>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
<input
type="date"
className="h-[42px] w-full border border-gray-300 rounded-lg px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
value={pendingDayRange.end}
min={pendingDayRange.start || undefined}
onChange={(e) => handleDayRangeChange("end", e.target.value)}
/>
</div>

<button
type="button"
onClick={applyDayRangeSelection}
className="w-full bg-[#6B46C1] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#5B34B8] transition-colors"
>
Apply
</button>
</>
)}
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
<Card
className={`relative overflow-hidden ${
              canOpenFeedbackTab ? "cursor-pointer hover:shadow-md transition-shadow duration-200" : ""
            }`}
onClick={canOpenFeedbackTab ? handleOpenFeedbackTab : undefined}
onKeyDown={canOpenFeedbackTab ? handleFeedbackCardKeyDown : undefined}
role={canOpenFeedbackTab ? "button" : undefined}
tabIndex={canOpenFeedbackTab ? 0 : undefined}
aria-label={canOpenFeedbackTab ? "Open feedback section" : undefined}
>
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent no-print"></div>

<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
<div className="flex items-center gap-3">
<div className="p-2 bg-gray-100 rounded-lg text-gray-700">
<MessageSquare size={20} />
</div>
<h3 className="font-bold text-lg text-gray-800 dark:text-white">Feedback Insights</h3>
</div>

{canOpenFeedbackTab && (
<p className="text-xs text-purple-700 font-medium">Click to open Feedback</p>
)}

{/* <div className="relative no-print">
                <button 
                  onClick={() => setShowIntegratedModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg shadow-purple-200"
                >
                  <FileText size={16} />
                  <span>Integrate</span>
                </button>
              </div> */}
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
<div className="mb-2">
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
</div>
<p className="text-gray-400 text-xs">
{feedback.visitorDate || (feedback.createdAt ? (feedback.createdAt.toDate ? feedback.createdAt.toDate() : new Date(feedback.createdAt)).toLocaleDateString() : 'N/A')}
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

{showPrintSignatoryModal && (
<div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/10 backdrop-blur-[2px] p-4 no-print print:hidden">
<div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
<div className="mb-4">
<h3 className="text-xl font-bold text-gray-900">Print Signatories</h3>
<p className="mt-1 text-sm text-gray-600">
Enter the names for the printed report, then continue printing.
</p>
</div>

<div className="flex flex-col gap-4">
<label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
<span>Prepared</span>
<input
type="text"
value={printSignatories.prepared}
onChange={(e) => handlePrintSignatoryChange("prepared", e.target.value)}
placeholder="Enter name"
className="h-[42px] rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
/>
</label>

<label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
<span>Verified</span>
<input
type="text"
value={printSignatories.verified}
onChange={(e) => handlePrintSignatoryChange("verified", e.target.value)}
placeholder="Enter name"
className="h-[42px] rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
/>
</label>

<label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
<span>Approved</span>
<input
type="text"
value={printSignatories.approved}
onChange={(e) => handlePrintSignatoryChange("approved", e.target.value)}
placeholder="Enter name"
className="h-[42px] rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
/>
</label>
</div>

<div className="mt-6 flex justify-end gap-3">
<button
type="button"
onClick={() => setShowPrintSignatoryModal(false)}
className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
>
Cancel
</button>
<button
type="button"
onClick={handleConfirmPrint}
className="inline-flex items-center gap-2 rounded-lg bg-[#553C9A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#44307B]"
>
<Printer size={16} />
<span>Continue to Print</span>
</button>
</div>
</div>
</div>
)}

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
{currentUser && currentUser.type === "OfficeAdmin" && ` | ${officialOfficeDisplayName} Office`}
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
{renderNarrativeText(paragraph)}
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
<span>Print Report</span>
</button>
</div>
</div>
</div>
</div>
)}

{/* Overall Analytics Integration Modal */}
{showOverallModal && (
<div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
{currentUser && currentUser.type === "OfficeAdmin" && ` | ${officialOfficeDisplayName} Office`}
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
{(() => {
const lines = generateOverallNarrative().split('\n');
const elements = [];
const bulletItems = [];

const flushBullets = (key) => {
if (!bulletItems.length) return;

const items = [...bulletItems];
bulletItems.length = 0;

elements.push(
<ul key={`bullets-${key}`} className="list-disc list-outside ml-6 mb-4 space-y-2 text-gray-700">
{items.map((item, itemIndex) => (
<li key={`bullet-${key}-${itemIndex}`} className="leading-relaxed">
{renderNarrativeText(item)}
</li>
))}
</ul>
);
};

lines.forEach((line, idx) => {
const trimmed = line.trim();

if (!trimmed) {
flushBullets(`break-${idx}`);
return;
}

if (trimmed.startsWith('- ')) {
bulletItems.push(trimmed.substring(2).trim());
return;
}

flushBullets(`line-${idx}`);

if (trimmed.startsWith('# ')) {
elements.push(
<h1 key={`h1-${idx}`} className="text-3xl font-bold text-gray-900 mt-8 mb-4 first:mt-0">
{trimmed.substring(2)}
</h1>
);
return;
}

if (trimmed.startsWith('## ')) {
elements.push(
<h2 key={`h2-${idx}`} className="text-2xl font-bold text-gray-800 mt-6 mb-3 pb-2 border-b-2 border-gray-200">
{trimmed.substring(3)}
</h2>
);
return;
}

elements.push(
<p key={`p-${idx}`} className="text-gray-700 leading-relaxed mb-4 text-justify">
{renderNarrativeText(trimmed)}
</p>
);
});

flushBullets('final');
return elements;
})()}
</div>
</div>

{/* Modal Footer */}
<div className="border-t border-gray-200 p-6 bg-gray-50">
<div className="flex justify-between items-center">
<p className="text-sm text-gray-500">
Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
</p>
<button
onClick={() => setShowOverallModal(false)}
className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
>
Close
</button>
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
