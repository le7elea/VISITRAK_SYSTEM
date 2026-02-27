import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const getOfficeByUid = async (uid) => {
  if (!uid) return null;

  // Primary: office doc id matches auth uid.
  const byId = await getDoc(doc(db, "offices", uid));
  if (byId.exists()) {
    return { id: byId.id, ...byId.data() };
  }

  // Transition support: office stores uid as a field.
  const byUid = await getDocs(
    query(collection(db, "offices"), where("uid", "==", uid), limit(1))
  );
  if (!byUid.empty) {
    const d = byUid.docs[0];
    return { id: d.id, ...d.data() };
  }

  return null;
};

const getOfficeByEmail = async (email) => {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;

  const byEmail = await getDocs(
    query(collection(db, "offices"), where("email", "==", cleanEmail), limit(1))
  );

  if (byEmail.empty) return null;

  const d = byEmail.docs[0];
  return { id: d.id, ...d.data() };
};

export const getOfficeProfileForAuthUser = async (authUser) => {
  if (!authUser) return null;

  const byUid = await getOfficeByUid(authUser.uid);
  if (byUid) return byUid;

  // Fallback for legacy docs not keyed by uid.
  return getOfficeByEmail(authUser.email || "");
};

export const buildSessionUser = (authUser, officeData = null) => {
  if (!authUser) return null;

  const role = officeData?.role || "office";
  const username = (officeData?.username || "").trim().toLowerCase();
  const officeName =
    officeData?.name ||
    authUser.displayName ||
    (authUser.email ? authUser.email.split("@")[0] : "User");
  const email = normalizeEmail(authUser.email || officeData?.email || "");

  return {
    uid: authUser.uid,
    id: officeData?.id || authUser.uid,
    email,
    username,
    loginIdentifier: role === "office" && username ? username : email,
    name: officeName,
    office: officeName,
    officeName,
    role,
    type: role === "super" ? "SuperAdmin" : "OfficeAdmin",
    status: officeData?.status || "active",
    passwordChanged: officeData?.passwordChanged === true,
    passwordChangedAt: officeData?.passwordChangedAt || null,
    isInDatabase: !!officeData,
    emailVerified: authUser.emailVerified,
    authProvider: "firebase-auth",
    normalizedOffice: officeName.toLowerCase(),
    trimmedOffice: officeName.trim(),
  };
};
