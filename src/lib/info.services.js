// lib/info.services.js - COMPLETE FIXED VERSION WITH MEMORY STORE
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

// 🔹 Reference to the collections
const officesCollection = collection(db, "offices");
const activityLogsCollection = collection(db, "activityLogs");
const passwordResetTokensCollection = collection(db, "passwordResetTokens");

// 🔹 MEMORY STORE for when Firestore quota is exceeded
const MEMORY_TOKEN_STORE = new Map();

// 🔹 Clean up expired memory tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  
  for (const [token, data] of MEMORY_TOKEN_STORE.entries()) {
    if (data.expiresAt && new Date(data.expiresAt) < now) {
      MEMORY_TOKEN_STORE.delete(token);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired tokens from memory store`);
  }
}, 5 * 60 * 1000);

/**
 * Create an activity log
 */
const createActivityLog = async (logData) => {
  try {
    const logWithTimestamp = {
      ...logData,
      timestamp: serverTimestamp(),
    };
    
    await addDoc(activityLogsCollection, logWithTimestamp);
    console.log("✅ Activity log created:", logData.title, "for office:", logData.office);
    return true;
  } catch (error) {
    console.error("❌ Error creating activity log:", error);
    // Don't throw - we don't want office operations to fail because of logging
    return false;
  }
};

/**
 * Get current user from localStorage (for activity logs)
 */
const getCurrentUser = () => {
  try {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      console.log("🔍 Current user for activity log:", user);
      return {
        email: user.email || "unknown@email.com",
        name: user.name || "Unknown User",
        role: user.role || "unknown",
        office: user.office || "System"
      };
    }
    return {
      email: "system@admin.com",
      name: "System Administrator",
      role: "system",
      office: "System"
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return {
      email: "system@admin.com",
      name: "System Administrator",
      role: "system",
      office: "System"
    };
  }
};

/**
 * Fetch all offices from Firestore
 */
export const fetchOffices = async () => {
  try {
    const snapshot = await getDocs(officesCollection);
    const offices = snapshot.docs.map((doc) => ({ 
      id: doc.id, 
      ...doc.data(),
      // Ensure all fields exist with default values
      officialName: doc.data().officialName || "",
      purposes: doc.data().purposes || [],
      staffToVisit: doc.data().staffToVisit || []
    }));
    
    console.log(`✅ Fetched ${offices.length} offices`);
    return offices;
  } catch (error) {
    console.error("Error fetching offices:", error);
    throw error;
  }
};

/**
 * Get a specific office by ID
 */
export const getOfficeById = async (id) => {
  try {
    const officeRef = doc(db, "offices", id);
    const officeSnap = await getDoc(officeRef);
    
    if (officeSnap.exists()) {
      const data = officeSnap.data();
      return { 
        id: officeSnap.id, 
        ...data,
        // Ensure all fields exist with default values
        officialName: data.officialName || "",
        purposes: data.purposes || [],
        staffToVisit: data.staffToVisit || []
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting office by ID:", error);
    throw error;
  }
};

/**
 * Get office by email (for profile lookup)
 */
export const getOfficeByEmail = async (email) => {
  try {
    const q = query(officesCollection, where("email", "==", email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return { 
      id: docSnap.id, 
      ...data,
      // Ensure all fields exist with default values
      officialName: data.officialName || "",
      purposes: data.purposes || [],
      staffToVisit: data.staffToVisit || []
    };
  } catch (error) {
    console.error("Error getting office by email:", error);
    throw error;
  }
};

/* =============================
   PASSWORD RESET FUNCTIONS - WITH MEMORY STORE SUPPORT
============================= */

/**
 * ADD TOKEN TO MEMORY STORE (Called from send-password-reset.js)
 */
export const addTokenToMemoryStore = (tokenData) => {
  try {
    const { token, email, officeName, officialName, expiresAt, officeId } = tokenData;
    
    if (!token || !email) {
      console.error("❌ Cannot add token to memory store: missing token or email");
      return false;
    }
    
    const cleanToken = token.trim();
    const cleanEmail = email.toLowerCase().trim();
    
    const memoryTokenData = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: cleanEmail,
      token: cleanToken,
      officeId: officeId || null,
      officeName: officeName || 'Office',
      officialName: officialName || '',
      expiresAt: expiresAt || new Date(Date.now() + 15 * 60 * 1000),
      used: false,
      createdAt: new Date().toISOString(),
      storedIn: 'memory'
    };
    
    MEMORY_TOKEN_STORE.set(cleanToken, memoryTokenData);
    
    console.log("✅ Token added to memory store:", {
      tokenId: memoryTokenData.id,
      token: cleanToken.substring(0, 20) + '...',
      email: cleanEmail,
      expiresAt: memoryTokenData.expiresAt.toISOString(),
      memoryStoreSize: MEMORY_TOKEN_STORE.size
    });
    
    return memoryTokenData.id;
  } catch (error) {
    console.error("❌ Error adding token to memory store:", error);
    return false;
  }
};

/**
 * Validate password reset token with email verification - WITH MEMORY STORE SUPPORT
 */
export const validatePasswordResetToken = async (token, email = null) => {
  try {
    console.log("🔍 [validatePasswordResetToken] called with:", { 
      token: token?.substring(0, 20) + (token?.length > 20 ? '...' : ''),
      email: email || 'not provided',
      tokenLength: token?.length
    });

    if (!token || token.trim() === '') {
      console.error("❌ Token is required");
      return null;
    }

    const cleanToken = token.trim();
    
    let cleanEmail = null;
    if (email) {
      try {
        cleanEmail = decodeURIComponent(email).trim().toLowerCase();
      } catch (e) {
        cleanEmail = email.trim().toLowerCase();
      }
      console.log("📧 Clean email for verification:", cleanEmail);
    }

    console.log("🔑 Querying with token (first 20 chars):", cleanToken.substring(0, 20) + '...');

    let tokenData = null;
    let tokenId = null;
    let foundIn = null;

    // ========== STEP 1: CHECK MEMORY STORE FIRST (No Firestore quota usage) ==========
    console.log("1️⃣ Checking memory store first...");
    if (MEMORY_TOKEN_STORE.has(cleanToken)) {
      tokenData = MEMORY_TOKEN_STORE.get(cleanToken);
      tokenId = tokenData.id;
      foundIn = 'memory';
      console.log("   ✅ Found token in memory store");
    } else {
      console.log("   ❌ Token not found in memory store");
    }

    // ========== STEP 2: CHECK FIRESTORE (if memory store doesn't have it) ==========
    if (!tokenData) {
      console.log("2️⃣ Checking Firestore...");
      try {
        // Query for the token
        const q = query(
          passwordResetTokensCollection,
          where("token", "==", cleanToken)
        );

        const querySnapshot = await getDocs(q);
        
        console.log("   📊 Firestore query results:", querySnapshot.size, "documents found");
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          tokenData = docSnap.data();
          tokenId = docSnap.id;
          foundIn = 'firestore';
          console.log("   ✅ Found token in Firestore");
          
          // Cache in memory for future lookups (reduces Firestore reads)
          MEMORY_TOKEN_STORE.set(cleanToken, {
            id: tokenId,
            ...tokenData,
            storedIn: 'firestore_cached'
          });
          console.log("   📦 Cached Firestore token in memory");
        } else {
          console.log("   ❌ Token not found in Firestore");
        }
      } catch (firestoreError) {
        console.error("   ❌ Firestore query error (quota likely exceeded):", firestoreError.message);
        console.log("   ℹ️ Continuing with memory store only...");
      }
    }

    // ========== STEP 3: TOKEN NOT FOUND ANYWHERE ==========
    if (!tokenData) {
      console.log("❌ Token not found in any storage");
      console.log("   Memory store size:", MEMORY_TOKEN_STORE.size);
      console.log("   Available memory tokens:", Array.from(MEMORY_TOKEN_STORE.keys()).map(k => k.substring(0, 10) + '...'));
      return null;
    }

    console.log("📄 Token document found:", {
      id: tokenId,
      storedIn: foundIn,
      email: tokenData.email,
      tokenPreview: tokenData.token?.substring(0, 20) + '...',
      used: tokenData.used,
      expiresAt: tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate()?.toISOString() : tokenData.expiresAt?.toISOString()
    });

    // Verify email if provided
    if (cleanEmail) {
      const storedEmail = tokenData.email?.toLowerCase();
      if (storedEmail !== cleanEmail) {
        console.log(`❌ Email mismatch: expected ${cleanEmail}, got ${storedEmail}`);
        return null;
      }
      console.log("✅ Email verified successfully");
    }

    // Check if token is already used
    if (tokenData.used === true) {
      console.log("❌ Token already used");
      return null;
    }

    // Check if token has expired
    let expiresAt;
    if (tokenData.expiresAt && typeof tokenData.expiresAt.toDate === 'function') {
      expiresAt = tokenData.expiresAt.toDate();
    } else if (tokenData.expiresAt instanceof Date) {
      expiresAt = tokenData.expiresAt;
    } else if (tokenData.expiresAt && typeof tokenData.expiresAt === 'string') {
      expiresAt = new Date(tokenData.expiresAt);
    } else if (tokenData.expiresAt && tokenData.expiresAt._seconds) {
      // Handle Firestore Timestamp
      expiresAt = new Date(tokenData.expiresAt._seconds * 1000);
    } else {
      console.log("❌ Token has no valid expiration date");
      return null;
    }

    const now = new Date();
    
    console.log("⏰ Time check:", {
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isExpired: now > expiresAt
    });

    if (now > expiresAt) {
      console.log("❌ Token expired");
      return null;
    }

    console.log(`✅ Token is VALID and ACTIVE (found in: ${foundIn})`);
    return { 
      id: tokenId,
      foundIn: foundIn,
      ...tokenData,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error("❌ Error validating password reset token:", error);
    console.error("Stack:", error.stack);
    throw error;
  }
};

/**
 * Mark password reset token as used - WITH MEMORY STORE SUPPORT
 */
export const markPasswordResetTokenUsed = async (tokenId) => {
  try {
    console.log("🔐 Marking token as used:", tokenId);
    
    // Check if it's a memory token
    if (tokenId.startsWith('memory_')) {
      // Find token in memory store by ID
      for (const [token, data] of MEMORY_TOKEN_STORE.entries()) {
        if (data.id === tokenId) {
          data.used = true;
          data.usedAt = new Date().toISOString();
          MEMORY_TOKEN_STORE.set(token, data);
          console.log("✅ Memory token marked as used:", tokenId);
          return true;
        }
      }
      console.error("❌ Memory token not found:", tokenId);
      return false;
    } else {
      // Firestore token
      try {
        const tokenRef = doc(db, "passwordResetTokens", tokenId);
        
        // Verify the token exists
        const tokenSnap = await getDoc(tokenRef);
        if (!tokenSnap.exists()) {
          console.error("❌ Firestore token not found:", tokenId);
          // Try to find in memory store as fallback
          for (const [token, data] of MEMORY_TOKEN_STORE.entries()) {
            if (data.firestoreId === tokenId) {
              data.used = true;
              data.usedAt = new Date().toISOString();
              MEMORY_TOKEN_STORE.set(token, data);
              console.log("✅ Found and marked in memory store as fallback:", tokenId);
              return true;
            }
          }
          return false;
        }
        
        await updateDoc(tokenRef, {
          used: true,
          usedAt: serverTimestamp(),
        });
        
        console.log("✅ Firestore token marked as used:", tokenId);
        return true;
      } catch (firestoreError) {
        console.error("❌ Firestore error marking token as used (quota likely):", firestoreError.message);
        
        // Even if Firestore fails, try to mark in memory store as fallback
        console.log("🔄 Attempting to mark in memory store as fallback...");
        
        // Try to find the token in memory store
        for (const [token, data] of MEMORY_TOKEN_STORE.entries()) {
          if (data.firestoreId === tokenId || data.id === tokenId) {
            data.used = true;
            data.usedAt = new Date().toISOString();
            MEMORY_TOKEN_STORE.set(token, data);
            console.log("✅ Fallback: Marked token in memory store:", tokenId);
            return true;
          }
        }
        
        console.error("❌ Could not mark token as used in any store");
        return false;
      }
    }
  } catch (error) {
    console.error("❌ Error marking token as used:", error);
    throw error;
  }
};

/**
 * Update office password by email
 */
export const updateOfficePasswordByEmail = async (email, newPassword) => {
  try {
    console.log("🔑 Updating password for email:", email);
    
    const q = query(officesCollection, where("email", "==", email));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.error("❌ Office not found with email:", email);
      throw new Error("Office not found");
    }

    const officeDoc = snap.docs[0];
    const officeId = officeDoc.id;
    const officeData = officeDoc.data();
    
    console.log("🏢 Found office:", {
      id: officeId,
      name: officeData.name,
      email: officeData.email
    });

    await updateDoc(doc(db, "offices", officeId), {
      password: newPassword,
      updatedAt: serverTimestamp(),
    });

    console.log("✅ Password updated successfully for email:", email);
    return true;
  } catch (error) {
    console.error("❌ Error updating password:", error);
    throw error;
  }
};

/**
 * Create password reset activity log
 */
export const createPasswordResetActivityLog = async (email) => {
  try {
    console.log("📝 Creating password reset activity log for:", email);
    
    const logData = {
      title: "Password Reset",
      description: `Password reset completed for ${email}`,
      office: email.split('@')[0] || "Unknown Office",
      type: "password_reset",
      userEmail: email,
      userName: "System",
      userRole: "system",
      timestamp: serverTimestamp(),
      action: "reset"
    };
    
    await addDoc(activityLogsCollection, logData);
    console.log("✅ Password reset activity log created for:", email);
    return true;
  } catch (error) {
    console.error("❌ Error creating password reset activity log:", error);
    return false;
  }
};

/**
 * Check if email already exists (for validation)
 */
export const checkEmailExists = async (email, excludeId = null) => {
  try {
    const q = query(officesCollection, where("email", "==", email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return false;
    }
    
    // If excludeId is provided, check if it's the same office
    if (excludeId) {
      const offices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return offices.some(office => office.id !== excludeId);
    }
    
    return true;
  } catch (error) {
    console.error("Error checking email:", error);
    throw error;
  }
};

/**
 * Validate office data structure
 */
const validateOfficeData = (office) => {
  // Ensure arrays are properly formatted
  const validatedOffice = { ...office };
  
  // Ensure officialName exists
  if (!validatedOffice.officialName) {
    validatedOffice.officialName = "";
  }
  
  // Validate purposes array
  if (!validatedOffice.purposes || !Array.isArray(validatedOffice.purposes)) {
    validatedOffice.purposes = [];
  } else {
    // Ensure each purpose has required fields
    validatedOffice.purposes = validatedOffice.purposes.map((purpose, index) => ({
      id: purpose.id || `purpose_${Date.now()}_${index}`,
      name: purpose.name || `Purpose ${index + 1}`,
      ...purpose
    }));
  }
  
  // Validate staffToVisit array
  if (!validatedOffice.staffToVisit || !Array.isArray(validatedOffice.staffToVisit)) {
    validatedOffice.staffToVisit = [];
  } else {
    // Ensure each staff has required fields
    validatedOffice.staffToVisit = validatedOffice.staffToVisit.map((staff, index) => ({
      id: staff.id || `staff_${Date.now()}_${index}`,
      name: staff.name || `Staff ${index + 1}`,
      ...staff
    }));
  }
  
  return validatedOffice;
};

/**
 * Add a new office to Firestore WITH ACTIVITY LOG
 */
export const addOffice = async (office) => {
  try {
    // Check if email already exists
    const existingOffice = await getOfficeByEmail(office.email);
    if (existingOffice) {
      throw new Error(`Office with email ${office.email} already exists`);
    }
    
    const defaultPassword =
      office.role === "super" ? "superadmin2025" : "officeadmin2025";

    // Validate and format office data
    const validatedOffice = validateOfficeData(office);
    
    const officeWithPassword = {
      name: validatedOffice.name,
      officialName: validatedOffice.officialName, // NEW: Add officialName field
      email: validatedOffice.email,
      role: validatedOffice.role,
      password: defaultPassword,
      purposes: validatedOffice.purposes,
      staffToVisit: validatedOffice.staffToVisit,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(officesCollection, officeWithPassword);
    
    // 🔹 CRITICAL: Create activity log for the NEW OFFICE
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Office Created",
      description: `New office "${office.name}" (${office.officialName || 'No official name'}) was created with ${office.purposes?.length || 0} purposes and ${office.staffToVisit?.length || 0} staff members`,
      office: office.name, // THIS MUST MATCH the office name exactly
      type: "office_created",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      officeEmail: office.email,
      officeRole: office.role,
      officialOfficeName: office.officialName || '', // NEW: Add to activity log
      purposesCount: office.purposes?.length || 0,
      staffCount: office.staffToVisit?.length || 0,
      action: "create"
    });
    
    console.log(`✅ Office "${office.name}" added successfully with activity log`);
    console.log(`   - Official Name: ${office.officialName || 'Not provided'}`);
    console.log(`   - Purposes: ${office.purposes?.length || 0} items`);
    console.log(`   - Staff to visit: ${office.staffToVisit?.length || 0} items`);
    
    // Return with ID and a fallback date for immediate UI display
    return { 
      id: docRef.id, 
      ...officeWithPassword,
      createdAt: new Date() // Fallback for immediate display
    };
  } catch (error) {
    console.error("Error adding office:", error);
    throw error;
  }
};

/**
 * Update an existing office WITH ACTIVITY LOG
 */
export const updateOffice = async (office) => {
  try {
    const officeRef = doc(db, "offices", office.id);
    
    // First, get current office data
    const currentOfficeSnap = await getDoc(officeRef);
    if (!currentOfficeSnap.exists()) {
      throw new Error(`Office with ID ${office.id} not found`);
    }
    
    const currentData = currentOfficeSnap.data();
    
    // Validate and format update data
    const validatedOffice = validateOfficeData(office);
    
    const updateData = {
      name: validatedOffice.name,
      officialName: validatedOffice.officialName, // NEW: Update officialName field
      email: validatedOffice.email,
      role: validatedOffice.role,
      purposes: validatedOffice.purposes,
      staffToVisit: validatedOffice.staffToVisit,
      updatedAt: serverTimestamp(),
    };

    // Only update password if provided
    if (office.password) {
      updateData.password = office.password;
    }

    await updateDoc(officeRef, updateData);
    
    // 🔹 CRITICAL: Create activity log for the UPDATED OFFICE
    const currentUser = getCurrentUser();
    
    let description = `Office "${office.name}" was updated`;
    let changes = [];
    
    // Track what changed
    if (office.password && office.password !== currentData.password) {
      changes.push("password changed");
    }
    if (office.name !== currentData.name) {
      changes.push(`name changed from "${currentData.name}" to "${office.name}"`);
    }
    if (office.officialName !== currentData.officialName) {
      changes.push(`official name changed from "${currentData.officialName || 'none'}" to "${office.officialName || 'none'}"`);
    }
    if (office.email !== currentData.email) {
      changes.push(`email changed from "${currentData.email}" to "${office.email}"`);
    }
    if (office.role !== currentData.role) {
      changes.push(`role changed from "${currentData.role}" to "${office.role}"`);
    }
    
    // Track array changes
    const currentPurposesCount = currentData.purposes?.length || 0;
    const newPurposesCount = office.purposes?.length || 0;
    if (currentPurposesCount !== newPurposesCount) {
      changes.push(`purposes changed from ${currentPurposesCount} to ${newPurposesCount}`);
    }
    
    const currentStaffCount = currentData.staffToVisit?.length || 0;
    const newStaffCount = office.staffToVisit?.length || 0;
    if (currentStaffCount !== newStaffCount) {
      changes.push(`staff list changed from ${currentStaffCount} to ${newStaffCount}`);
    }
    
    if (changes.length > 0) {
      description += ` (${changes.join(', ')})`;
    }
    
    await createActivityLog({
      title: "Office Updated",
      description: description,
      office: office.name, // THIS MUST MATCH the office name exactly
      type: "office_updated",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      previousName: currentData.name,
      newName: office.name,
      previousOfficialName: currentData.officialName || '', // NEW: Add to activity log
      newOfficialName: office.officialName || '', // NEW: Add to activity log
      purposesCount: newPurposesCount,
      staffCount: newStaffCount,
      action: "update"
    });
    
    console.log(`✅ Office "${office.name}" updated successfully with activity log`);
    console.log(`   - Official Name: ${office.officialName || 'Not provided'}`);
    console.log(`   - New purposes count: ${newPurposesCount}`);
    console.log(`   - New staff count: ${newStaffCount}`);
    
    // Return updated office data
    return { 
      id: office.id, 
      ...updateData,
      // Ensure we return the arrays
      officialName: validatedOffice.officialName,
      purposes: validatedOffice.purposes,
      staffToVisit: validatedOffice.staffToVisit
    };
  } catch (error) {
    console.error("Error updating office:", error);
    throw error;
  }
};

/**
 * Delete an office by ID WITH ACTIVITY LOG
 */
export const deleteOffice = async (id) => {
  try {
    const officeRef = doc(db, "offices", id);
    const officeDoc = await getDoc(officeRef);
    
    if (!officeDoc.exists()) {
      throw new Error(`Office with ID ${id} not found`);
    }
    
    const officeData = officeDoc.data();
    
    // 🔹 CRITICAL: Create activity log BEFORE deleting
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Office Deleted",
      description: `Office "${officeData.name}" (${officeData.officialName || 'No official name'}) was deleted from the system. Removed ${officeData.purposes?.length || 0} purposes and ${officeData.staffToVisit?.length || 0} staff records`,
      office: officeData.name, // THIS MUST MATCH the office name exactly
      type: "office_deleted",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      deletedOfficeName: officeData.name,
      deletedOfficialName: officeData.officialName || '', // NEW: Add to activity log
      deletedOfficeEmail: officeData.email,
      deletedPurposesCount: officeData.purposes?.length || 0,
      deletedStaffCount: officeData.staffToVisit?.length || 0,
      action: "delete"
    });
    
    // Now delete the office
    await deleteDoc(officeRef);
    
    console.log(`✅ Office "${officeData.name}" deleted successfully with activity log`);
    console.log(`   - Official Name: ${officeData.officialName || 'Not provided'}`);
    console.log(`   - Removed ${officeData.purposes?.length || 0} purposes`);
    console.log(`   - Removed ${officeData.staffToVisit?.length || 0} staff records`);
    return { 
      success: true, 
      id, 
      deletedOffice: officeData.name,
      deletedOfficialName: officeData.officialName || '',
      deletedPurposesCount: officeData.purposes?.length || 0,
      deletedStaffCount: officeData.staffToVisit?.length || 0
    };
  } catch (error) {
    console.error("Error deleting office:", error);
    throw error;
  }
}; 

/**
 * Update office WITH ACTIVITY LOG (wrapper for backward compatibility)
 */
export const updateOfficeWithLog = async (office) => {
  return updateOffice(office);
};

/**
 * Delete office WITH ACTIVITY LOG (wrapper for backward compatibility)
 */
export const deleteOfficeWithLog = async (id) => {
  return deleteOffice(id);
};

/**
 * Add office WITH ACTIVITY LOG (wrapper for backward compatibility)
 */
export const addOfficeWithLog = async (office) => {
  return addOffice(office);
};

/**
 * Create a login activity log (for Login.jsx)
 */
export const createLoginActivityLog = async (userData) => {
  try {
    const logData = {
      title: "User Login",
      description: `${userData.name} logged into the system`,
      office: userData.office || userData.name,
      type: "login",
      userEmail: userData.email,
      userName: userData.name,
      userRole: userData.role,
      timestamp: serverTimestamp(),
      action: "login"
    };
    
    await addDoc(activityLogsCollection, logData);
    console.log("✅ Login activity log created for:", userData.name);
    return true;
  } catch (error) {
    console.error("❌ Error creating login activity log:", error);
    return false;
  }
};

/**
 * Get offices with specific purpose (for filtering/searching)
 */
export const getOfficesByPurpose = async (purposeName) => {
  try {
    const allOffices = await fetchOffices();
    
    // Filter offices that have the specified purpose
    const filteredOffices = allOffices.filter(office => 
      office.purposes && 
      office.purposes.some(purpose => 
        purpose.name.toLowerCase().includes(purposeName.toLowerCase())
      )
    );
    
    console.log(`✅ Found ${filteredOffices.length} offices with purpose containing "${purposeName}"`);
    return filteredOffices;
  } catch (error) {
    console.error("Error getting offices by purpose:", error);
    throw error;
  }
};

/**
 * Get offices with specific staff (for filtering/searching)
 */
export const getOfficesByStaff = async (staffName) => {
  try {
    const allOffices = await fetchOffices();
    
    // Filter offices that have the specified staff
    const filteredOffices = allOffices.filter(office => 
      office.staffToVisit && 
      office.staffToVisit.some(staff => 
        staff.name.toLowerCase().includes(staffName.toLowerCase())
      )
    );
    
    console.log(`✅ Found ${filteredOffices.length} offices with staff containing "${staffName}"`);
    return filteredOffices;
  } catch (error) {
    console.error("Error getting offices by staff:", error);
    throw error;
  }
};

/**
 * Add a new purpose to an existing office
 */
export const addPurposeToOffice = async (officeId, purpose) => {
  try {
    const office = await getOfficeById(officeId);
    if (!office) {
      throw new Error(`Office with ID ${officeId} not found`);
    }
    
    const newPurpose = {
      id: `purpose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: purpose.name || "New Purpose",
      ...purpose
    };
    
    const updatedPurposes = [...(office.purposes || []), newPurpose];
    
    const updateData = {
      purposes: updatedPurposes,
      updatedAt: serverTimestamp()
    };
    
    const officeRef = doc(db, "offices", officeId);
    await updateDoc(officeRef, updateData);
    
    // Create activity log
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Purpose Added",
      description: `Purpose "${purpose.name}" was added to office "${office.name}"`,
      office: office.name,
      type: "purpose_added",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      purposeName: purpose.name,
      action: "update"
    });
    
    console.log(`✅ Purpose "${purpose.name}" added to office "${office.name}"`);
    return { success: true, purpose: newPurpose };
  } catch (error) {
    console.error("Error adding purpose to office:", error);
    throw error;
  }
};

/**
 * Add a new staff member to an existing office
 */
export const addStaffToOffice = async (officeId, staff) => {
  try {
    const office = await getOfficeById(officeId);
    if (!office) {
      throw new Error(`Office with ID ${officeId} not found`);
    }
    
    const newStaff = {
      id: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: staff.name || "New Staff",
      ...staff
    };
    
    const updatedStaff = [...(office.staffToVisit || []), newStaff];
    
    const updateData = {
      staffToVisit: updatedStaff,
      updatedAt: serverTimestamp()
    };
    
    const officeRef = doc(db, "offices", officeId);
    await updateDoc(officeRef, updateData);
    
    // Create activity log
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Staff Added",
      description: `Staff "${staff.name}" was added to office "${office.name}"`,
      office: office.name,
      type: "staff_added",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      staffName: staff.name,
      action: "update"
    });
    
    console.log(`✅ Staff "${staff.name}" added to office "${office.name}"`);
    return { success: true, staff: newStaff };
  } catch (error) {
    console.error("Error adding staff to office:", error);
    throw error;
  }
};

/**
 * Remove a purpose from an office
 */
export const removePurposeFromOffice = async (officeId, purposeId) => {
  try {
    const office = await getOfficeById(officeId);
    if (!office) {
      throw new Error(`Office with ID ${officeId} not found`);
    }
    
    const purposeToRemove = office.purposes.find(p => p.id === purposeId);
    if (!purposeToRemove) {
      throw new Error(`Purpose with ID ${purposeId} not found`);
    }
    
    const updatedPurposes = office.purposes.filter(p => p.id !== purposeId);
    
    const updateData = {
      purposes: updatedPurposes,
      updatedAt: serverTimestamp()
    };
    
    const officeRef = doc(db, "offices", officeId);
    await updateDoc(officeRef, updateData);
    
    // Create activity log
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Purpose Removed",
      description: `Purpose "${purposeToRemove.name}" was removed from office "${office.name}"`,
      office: office.name,
      type: "purpose_removed",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      purposeName: purposeToRemove.name,
      action: "update"
    });
    
    console.log(`✅ Purpose "${purposeToRemove.name}" removed from office "${office.name}"`);
    return { success: true, purpose: purposeToRemove };
  } catch (error) {
    console.error("Error removing purpose from office:", error);
    throw error;
  }
};

/**
 * Remove a staff member from an office
 */
export const removeStaffFromOffice = async (officeId, staffId) => {
  try {
    const office = await getOfficeById(officeId);
    if (!office) {
      throw new Error(`Office with ID ${officeId} not found`);
    }
    
    const staffToRemove = office.staffToVisit.find(s => s.id === staffId);
    if (!staffToRemove) {
      throw new Error(`Staff with ID ${staffId} not found`);
    }
    
    const updatedStaff = office.staffToVisit.filter(s => s.id !== staffId);
    
    const updateData = {
      staffToVisit: updatedStaff,
      updatedAt: serverTimestamp()
    };
    
    const officeRef = doc(db, "offices", officeId);
    await updateDoc(officeRef, updateData);
    
    // Create activity log
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Staff Removed",
      description: `Staff "${staffToRemove.name}" was removed from office "${office.name}"`,
      office: office.name,
      type: "staff_removed",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      staffName: staffToRemove.name,
      action: "update"
    });
    
    console.log(`✅ Staff "${staffToRemove.name}" removed from office "${office.name}"`);
    return { success: true, staff: staffToRemove };
  } catch (error) {
    console.error("Error removing staff from office:", error);
    throw error;
  }
};

/**
 * Update office official name only
 */
export const updateOfficeOfficialName = async (officeId, officialName) => {
  try {
    const officeRef = doc(db, "offices", officeId);
    const officeSnap = await getDoc(officeRef);
    
    if (!officeSnap.exists()) {
      throw new Error(`Office with ID ${officeId} not found`);
    }
    
    const currentData = officeSnap.data();
    
    const updateData = {
      officialName: officialName || "",
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(officeRef, updateData);
    
    // Create activity log
    const currentUser = getCurrentUser();
    await createActivityLog({
      title: "Official Name Updated",
      description: `Office "${currentData.name}" official name changed from "${currentData.officialName || 'none'}" to "${officialName || 'none'}"`,
      office: currentData.name,
      type: "office_updated",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      previousOfficialName: currentData.officialName || '',
      newOfficialName: officialName || '',
      action: "update"
    });
    
    console.log(`✅ Office "${currentData.name}" official name updated to: ${officialName || 'none'}`);
    return { success: true, officialName };
  } catch (error) {
    console.error("Error updating office official name:", error);
    throw error;
  }
};

/**
 * Create password reset request activity log
 */
export const createPasswordResetRequestLog = async (email) => {
  try {
    console.log("📝 Creating password reset request log for:", email);
    
    const logData = {
      title: "Password Reset Request",
      description: `Password reset requested for ${email}`,
      office: email.split('@')[0] || "Unknown Office",
      type: "password_reset_request",
      userEmail: email,
      userName: "User",
      userRole: "user",
      timestamp: serverTimestamp(),
      action: "request"
    };
    
    await addDoc(activityLogsCollection, logData);
    console.log("✅ Password reset request log created for:", email);
    return true;
  } catch (error) {
    console.error("❌ Error creating password reset request log:", error);
    return false;
  }
};

/**
 * Get all password reset tokens (admin function)
 */
export const getAllPasswordResetTokens = async () => {
  try {
    const snapshot = await getDocs(passwordResetTokensCollection);
    const tokens = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      expiresAt: doc.data().expiresAt?.toDate() || null,
      createdAt: doc.data().createdAt?.toDate() || null,
      usedAt: doc.data().usedAt?.toDate() || null
    }));
    
    console.log(`✅ Fetched ${tokens.length} password reset tokens`);
    return tokens;
  } catch (error) {
    console.error("Error fetching password reset tokens:", error);
    throw error;
  }
};

/**
 * Debug function to check all tokens in database
 */
export const debugAllPasswordTokens = async () => {
  try {
    const snapshot = await getDocs(passwordResetTokensCollection);
    console.log("🔍 DEBUG: All password reset tokens in database:");
    
    const tokens = [];
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const expiresAt = data.expiresAt?.toDate();
      const isExpired = expiresAt ? new Date() > expiresAt : true;
      
      tokens.push({
        id: doc.id,
        ...data,
        expiresAt: expiresAt,
        isExpired: isExpired,
        createdAt: data.createdAt?.toDate() || null,
        usedAt: data.usedAt?.toDate() || null
      });
      
      console.log(`  ${index + 1}. ID: ${doc.id}`);
      console.log(`     Token: ${data.token?.substring(0, 30)}... (${data.token?.length || 0} chars)`);
      console.log(`     Email: ${data.email}`);
      console.log(`     Used: ${data.used}`);
      console.log(`     Expires: ${expiresAt?.toISOString()}`);
      console.log(`     Expired: ${isExpired ? 'YES' : 'NO'}`);
      console.log(`     Created: ${data.createdAt?.toDate()?.toISOString()}`);
      console.log(`     Used At: ${data.usedAt?.toDate()?.toISOString()}`);
      console.log(`     ---`);
    });
    
    console.log(`📊 Summary: ${tokens.length} total tokens, ${tokens.filter(t => !t.used && !t.isExpired).length} valid unused tokens`);
    
    return tokens;
  } catch (error) {
    console.error("Debug error:", error);
    return [];
  }
};

/**
 * Clean up expired tokens (admin/maintenance function)
 */
export const cleanupExpiredTokens = async () => {
  try {
    const tokens = await getAllPasswordResetTokens();
    const expiredTokens = tokens.filter(token => {
      const isExpired = token.expiresAt ? new Date() > token.expiresAt : true;
      return token.used || isExpired;
    });
    
    console.log(`🧹 Found ${expiredTokens.length} expired/used tokens to clean up`);
    
    for (const token of expiredTokens) {
      try {
        await deleteDoc(doc(db, "passwordResetTokens", token.id));
        console.log(`   Deleted token: ${token.id}`);
      } catch (error) {
        console.error(`   Failed to delete token ${token.id}:`, error.message);
      }
    }
    
    console.log(`✅ Cleanup completed. Deleted ${expiredTokens.length} tokens.`);
    return { deletedCount: expiredTokens.length };
  } catch (error) {
    console.error("Error cleaning up tokens:", error);
    throw error;
  }
};

/**
 * Debug memory store
 */
export const debugMemoryStore = () => {
  console.log("🧠 Memory Store Debug:");
  console.log(`   Size: ${MEMORY_TOKEN_STORE.size}`);
  
  const tokens = Array.from(MEMORY_TOKEN_STORE.entries()).map(([token, data]) => ({
    token: token.substring(0, 20) + '...',
    id: data.id,
    email: data.email,
    used: data.used,
    expiresAt: data.expiresAt?.toISOString?.() || data.expiresAt,
    storedIn: data.storedIn
  }));
  
  tokens.forEach((token, index) => {
    console.log(`   ${index + 1}. ${token.token} - ${token.email} - Used: ${token.used} - Stored in: ${token.storedIn}`);
  });
  
  return {
    size: MEMORY_TOKEN_STORE.size,
    tokens: tokens
  };
};

/**
 * Clear all memory tokens (for testing/reset)
 */
export const clearMemoryStore = () => {
  const size = MEMORY_TOKEN_STORE.size;
  MEMORY_TOKEN_STORE.clear();
  console.log(`🧹 Cleared ${size} tokens from memory store`);
  return { cleared: size };
};