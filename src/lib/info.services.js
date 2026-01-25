// lib/info.services.js - CORRECT VERSION USING FIRESTORE ONLY
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
  Timestamp,
} from "firebase/firestore";

// 🔹 Reference to the collections
const officesCollection = collection(db, "offices");
const activityLogsCollection = collection(db, "activityLogs");
const passwordResetTokensCollection = collection(db, "passwordResetTokens");

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
    if (typeof window === 'undefined') {
      return {
        email: "system@admin.com",
        name: "System Administrator",
        role: "system",
        office: "System"
      };
    }
    
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

/* =============================
   PASSWORD RESET FUNCTIONS - FIRESTORE ONLY
============================= */

/**
 * Validate password reset token with email verification
 */
export const validatePasswordResetToken = async (token, email = null) => {
  try {
    console.log("🔍 [validatePasswordResetToken] called with:", { 
      token: token?.substring(0, 20) + (token?.length > 20 ? '...' : ''),
      email: email || 'not provided',
      tokenLength: token?.length,
      time: new Date().toISOString()
    });

    if (!token || token.trim() === '') {
      console.error("❌ Token is required");
      return null;
    }

    const cleanToken = token.trim();
    const now = new Date();
    
    let cleanEmail = null;
    if (email) {
      try {
        cleanEmail = decodeURIComponent(email).trim().toLowerCase();
      } catch (e) {
        cleanEmail = email.trim().toLowerCase();
      }
      console.log("📧 Clean email for verification:", cleanEmail);
    }

    console.log("🔑 Querying Firestore for token...");

    // ========== QUERY FIRESTORE FOR TOKEN ==========
    try {
      // Query for the token
      const q = query(
        passwordResetTokensCollection,
        where("token", "==", cleanToken)
      );

      const querySnapshot = await getDocs(q);
      
      console.log("📊 Firestore query results:", querySnapshot.size, "documents found");
      
      if (querySnapshot.empty) {
        console.log("❌ Token not found in Firestore");
        return null;
      }
      
      const docSnap = querySnapshot.docs[0];
      const tokenData = docSnap.data();
      const tokenId = docSnap.id;
      
      console.log("📄 Token document found:", {
        id: tokenId,
        email: tokenData.email,
        tokenPreview: tokenData.token?.substring(0, 20) + '...',
        used: tokenData.used,
        expiresAt: tokenData.expiresAt?.toDate()?.toISOString()
      });

      // Verify email if provided
      if (cleanEmail && tokenData.email) {
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
        
        // Clean up used tokens periodically
        try {
          await deleteDoc(doc(db, "passwordResetTokens", tokenId));
          console.log("🧹 Cleaned up used token");
        } catch (e) {
          // Ignore cleanup errors
        }
        
        return null;
      }

      // Check if token has expired
      const expiresAt = tokenData.expiresAt?.toDate();
      if (!expiresAt) {
        console.log("❌ Token has no valid expiration date");
        return null;
      }

      console.log("⏰ Expiration check:", {
        now: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isExpired: now > expiresAt,
        timeLeft: Math.round((expiresAt - now) / 1000) + " seconds"
      });

      if (now > expiresAt) {
        console.log("❌ Token expired");
        
        // Mark as used to prevent reuse
        try {
          await updateDoc(doc(db, "passwordResetTokens", tokenId), {
            used: true,
            expiredAt: serverTimestamp()
          });
        } catch (e) {
          // Ignore update errors
        }
        
        return null;
      }

      console.log(`✅ Token is VALID and ACTIVE`);
      console.log(`   Time left: ${Math.round((expiresAt - now) / 60000)} minutes`);
      
      return { 
        id: tokenId,
        ...tokenData,
        expiresAt: expiresAt
      };
      
    } catch (firestoreError) {
      console.error("❌ Firestore query error:", firestoreError.message);
      
      // In development, we can provide a fallback for testing
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                           (typeof window !== 'undefined' && 
                            (window.location.hostname === 'localhost' || 
                             window.location.hostname.includes('vercel')));
      
      if (isDevelopment) {
        console.log("🔧 Development fallback - checking if token looks valid");
        // Only for testing - accept tokens that look like valid reset tokens
        if (cleanToken && cleanToken.length >= 32 && /^[a-f0-9]+$/i.test(cleanToken)) {
          console.log("⚠️ DEVELOPMENT MODE: Accepting token without Firestore validation");
          return {
            id: `dev_fallback_${Date.now()}`,
            email: cleanEmail || 'dev@example.com',
            token: cleanToken,
            officeId: 'dev_office_id',
            officeName: 'Development Office',
            officialName: 'Dev User',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            used: false,
            warning: 'Firestore unavailable, using development token for testing only'
          };
        }
      }
      
      throw new Error("Unable to validate token. Please try again.");
    }
    
  } catch (error) {
    console.error("❌ Error validating password reset token:", error);
    throw error;
  }
};

/**
 * Mark password reset token as used
 */
export const markPasswordResetTokenUsed = async (tokenId) => {
  try {
    console.log("🔐 Marking token as used:", tokenId);
    
    // Check if it's a development token
    if (tokenId.startsWith('dev_fallback_')) {
      console.log("ℹ️ Development token marked as used:", tokenId);
      return true;
    }
    
    // Firestore token
    const tokenRef = doc(db, "passwordResetTokens", tokenId);
    
    // Verify the token exists
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) {
      console.error("❌ Token not found:", tokenId);
      throw new Error("Token not found");
    }
    
    await updateDoc(tokenRef, {
      used: true,
      usedAt: serverTimestamp(),
    });
    
    console.log("✅ Token marked as used:", tokenId);
    return true;
  } catch (error) {
    console.error("❌ Error marking token as used:", error);
    throw error;
  }
};

/**
 * Clean up expired tokens from Firestore
 */
export const cleanupExpiredTokens = async () => {
  try {
    console.log("🧹 Starting expired token cleanup...");
    
    const now = new Date();
    const q = query(
      passwordResetTokensCollection,
      where("used", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    const tokens = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      expiresAt: doc.data().expiresAt?.toDate()
    }));
    
    const expiredTokens = tokens.filter(token => {
      return token.expiresAt && now > token.expiresAt;
    });
    
    console.log(`📊 Found ${tokens.length} active tokens, ${expiredTokens.length} expired`);
    
    // Mark expired tokens as used
    for (const token of expiredTokens) {
      try {
        await updateDoc(doc(db, "passwordResetTokens", token.id), {
          used: true,
          expiredAt: serverTimestamp(),
          autoCleaned: true
        });
        console.log(`   ✅ Marked expired token: ${token.id}`);
      } catch (error) {
        console.error(`   ❌ Failed to mark token ${token.id}:`, error.message);
      }
    }
    
    // Also clean up old used tokens (older than 24 hours)
    const usedQ = query(
      passwordResetTokensCollection,
      where("used", "==", true)
    );
    
    const usedSnapshot = await getDocs(usedQ);
    const oldUsedTokens = usedSnapshot.docs.filter(doc => {
      const usedAt = doc.data().usedAt?.toDate();
      const expiredAt = doc.data().expiredAt?.toDate();
      const checkDate = usedAt || expiredAt;
      return checkDate && (now - checkDate) > 24 * 60 * 60 * 1000;
    });
    
    for (const tokenDoc of oldUsedTokens) {
      try {
        await deleteDoc(doc(db, "passwordResetTokens", tokenDoc.id));
        console.log(`   🗑️ Deleted old used token: ${tokenDoc.id}`);
      } catch (error) {
        // Ignore deletion errors
      }
    }
    
    console.log(`✅ Cleanup completed. Marked ${expiredTokens.length} as expired, deleted ${oldUsedTokens.length} old tokens.`);
    return { 
      expiredMarked: expiredTokens.length, 
      oldDeleted: oldUsedTokens.length 
    };
  } catch (error) {
    console.error("Error cleaning up tokens:", error);
    throw error;
  }
};

/**
 * Get token by ID (for debugging)
 */
export const getTokenById = async (tokenId) => {
  try {
    const tokenRef = doc(db, "passwordResetTokens", tokenId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (tokenSnap.exists()) {
      return {
        id: tokenSnap.id,
        ...tokenSnap.data(),
        expiresAt: tokenSnap.data().expiresAt?.toDate(),
        createdAt: tokenSnap.data().createdAt?.toDate(),
        usedAt: tokenSnap.data().usedAt?.toDate()
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting token by ID:", error);
    throw error;
  }
};

/**
 * Delete token by ID (admin function)
 */
export const deleteTokenById = async (tokenId) => {
  try {
    await deleteDoc(doc(db, "passwordResetTokens", tokenId));
    console.log("✅ Token deleted:", tokenId);
    return true;
  } catch (error) {
    console.error("Error deleting token:", error);
    throw error;
  }
};

/**
 * Get all tokens for an email (for debugging)
 */
export const getTokensByEmail = async (email) => {
  try {
    const q = query(
      passwordResetTokensCollection,
      where("email", "==", email.toLowerCase().trim())
    );
    
    const snapshot = await getDocs(q);
    const tokens = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      expiresAt: doc.data().expiresAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      usedAt: doc.data().usedAt?.toDate()
    }));
    
    console.log(`✅ Found ${tokens.length} tokens for email: ${email}`);
    return tokens;
  } catch (error) {
    console.error("Error getting tokens by email:", error);
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
      officialName: validatedOffice.officialName,
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
      office: office.name,
      type: "office_created",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      officeEmail: office.email,
      officeRole: office.role,
      officialOfficeName: office.officialName || '',
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
      officialName: data.officialName || "",
      purposes: data.purposes || [],
      staffToVisit: data.staffToVisit || []
    };
  } catch (error) {
    console.error("Error getting office by email:", error);
    throw error;
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
      officialName: validatedOffice.officialName,
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
      office: office.name,
      type: "office_updated",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      previousName: currentData.name,
      newName: office.name,
      previousOfficialName: currentData.officialName || '',
      newOfficialName: office.officialName || '',
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
      office: officeData.name,
      type: "office_deleted",
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      deletedOfficeName: officeData.name,
      deletedOfficialName: officeData.officialName || '',
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
 * Get active (unexpired, unused) tokens count
 */
export const getActiveTokensCount = async () => {
  try {
    const tokens = await getAllPasswordResetTokens();
    const now = new Date();
    const activeTokens = tokens.filter(token => {
      return !token.used && token.expiresAt && now < token.expiresAt;
    });
    
    return activeTokens.length;
  } catch (error) {
    console.error("Error getting active tokens count:", error);
    return 0;
  }
};

/**
 * Setup periodic token cleanup (call this once in your app)
 */
export const setupTokenCleanup = () => {
  if (typeof window !== 'undefined') {
    // Clean up every hour
    setInterval(async () => {
      try {
        const result = await cleanupExpiredTokens();
        if (result.expiredMarked > 0 || result.oldDeleted > 0) {
          console.log(`🔄 Periodic cleanup: ${result.expiredMarked} expired marked, ${result.oldDeleted} old deleted`);
        }
      } catch (error) {
        console.error("Periodic cleanup error:", error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    console.log("✅ Token cleanup scheduled (every hour)");
  }
};

// Schedule cleanup if in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    setupTokenCleanup();
  }, 10000); // Start after 10 seconds
}

/**
 * Wrapper functions for backward compatibility
 */
export const updateOfficeWithLog = async (office) => {
  return updateOffice(office);
};

export const deleteOfficeWithLog = async (id) => {
  return deleteOffice(id);
};

export const addOfficeWithLog = async (office) => {
  return addOffice(office);
};