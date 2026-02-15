// lib/auth.services.js
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged,
  updatePassword,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";

// 🔹 Register a new office user
export const registerOfficeUser = async (officeData) => {
  try {
    const { email, password, name, role, officialName } = officeData;
    
    console.log("🔐 Starting user registration for:", email);
    
    // 1. Check if email already exists in Firestore
    const emailCheckQuery = query(
      collection(db, "offices"), 
      where("email", "==", email.toLowerCase())
    );
    const emailCheckSnapshot = await getDocs(emailCheckQuery);
    
    if (!emailCheckSnapshot.empty) {
      throw new Error(`Email ${email} is already registered`);
    }
    
    // 2. Create Firebase Auth user 
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      email, 
      password || "officeadmin2025"
    );
    
    const user = userCredential.user;
    console.log("✅ Firebase Auth user created:", user.uid);
    
    // 3. Update display name
    await updateProfile(user, {
      displayName: name
    });
    
    // 4. Create Firestore office document
    const officeDoc = {
      uid: user.uid, // Link to Firebase Auth UID
      name,
      officialName: officialName || name,
      email,
      role: role || "office",
      purposes: officeData.purposes || [],
      staffToVisit: officeData.staffToVisit || [],
      password: password || "officeadmin2025",
      createdAt: new Date().toISOString(),
      authProvider: "email/password",
      emailVerified: false,
      status: "active",
      lastLogin: null
    };
    
    await setDoc(doc(db, "offices", user.uid), officeDoc);
    console.log("✅ Firestore office document created");
    
    // 5. Send email verification
    await sendEmailVerification(user);
    console.log("✅ Email verification sent");
    
    return {
      ...officeDoc,
      id: user.uid,
      emailVerified: false
    };
    
  } catch (error) {
    console.error("❌ Error registering office user:", error);
    
    // Handle specific errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error("Email already exists. Please use a different email.");
    } else if (error.code === 'auth/invalid-email') {
      throw new Error("Invalid email format.");
    } else if (error.code === 'auth/weak-password') {
      throw new Error("Password is too weak. Use at least 6 characters.");
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Email/password authentication is not enabled.");
    } else {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }
};

// 🔹 Login office user
export const loginOfficeUser = async (email, password) => {
  try {
    console.log("🔐 Attempting login for:", email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("✅ Firebase Auth login successful:", user.uid);
    
    // Get office data from Firestore using UID
    const officeRef = doc(db, "offices", user.uid);
    const officeSnapshot = await getDoc(officeRef);
    
    if (!officeSnapshot.exists()) {
      console.error("❌ Office document not found for UID:", user.uid);
      throw new Error("Office account not configured properly. Please contact administrator.");
    }
    
    const officeData = officeSnapshot.data();
    
    // Check if office is active
    if (officeData.status === "inactive") {
      throw new Error("Account is inactive. Please contact administrator.");
    }
    
    // Update last login time
    await updateDoc(officeRef, {
      lastLogin: new Date().toISOString()
    });
    
    // Create user session object
    const userSession = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || officeData.name,
      emailVerified: user.emailVerified,
      officeData: {
        ...officeData,
        id: user.uid
      }
    };
    
    console.log("✅ Login successful for:", user.email);
    return userSession;
    
  } catch (error) {
    console.error("❌ Login error:", error);
    
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error("Invalid email or password.");
    } else if (error.code === 'auth/user-disabled') {
      throw new Error("Account is disabled. Please contact administrator.");
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error("Too many failed attempts. Please try again later.");
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error("Invalid credentials.");
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error("Network error. Please check your connection.");
    } else {
      throw new Error(`Login failed: ${error.message}`);
    }
  }
};

// 🔹 Logout user
export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log("✅ User logged out");
    
    // Clear local storage
    localStorage.removeItem("officeUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    
    return true;
  } catch (error) {
    console.error("❌ Error logging out:", error);
    throw error;
  }
};

// 🔹 Reset password via Firebase Auth
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log("✅ Password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Error sending password reset:", error);
    
    if (error.code === 'auth/user-not-found') {
      throw new Error("No account found with this email.");
    } else if (error.code === 'auth/invalid-email') {
      throw new Error("Invalid email address.");
    } else {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }
};

// 🔹 Change password (for logged-in users)
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("No user is signed in.");
    }
    
    if (!currentPassword || !newPassword) {
      throw new Error("Both current and new password are required.");
    }
    
    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long.");
    }
    
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password in Firebase Auth
    await updatePassword(user, newPassword);
    
    // Update password metadata in Firestore
    await updateDoc(doc(db, "offices", user.uid), {
      passwordChanged: true,
      passwordChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log("✅ Password changed successfully");
    return true;
  } catch (error) {
    console.error("❌ Error changing password:", error);
    
    if (error.code === 'auth/wrong-password') {
      throw new Error("Current password is incorrect.");
    } else if (error.code === 'auth/weak-password') {
      throw new Error("New password is too weak. Use at least 6 characters.");
    } else if (error.code === 'auth/requires-recent-login') {
      throw new Error("Please re-login to change your password.");
    } else {
      throw new Error(`Password change failed: ${error.message}`);
    }
  }
};

// 🔹 Get current authenticated user
export const getCurrentAuthUser = () => {
  return auth.currentUser;
};

// 🔹 Check if user is authenticated
export const isAuthenticated = () => {
  const user = auth.currentUser;
  return !!user;
};

// 🔹 Auth state change listener
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// 🔹 Verify email (resend verification)
export const verifyEmail = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      console.log("✅ Email verification sent");
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Error sending email verification:", error);
    throw error;
  }
};

// 🔹 Update user profile
export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateProfile(user, updates);
      
      // Also update in Firestore if displayName changed
      if (updates.displayName) {
        await updateDoc(doc(db, "offices", user.uid), {
          name: updates.displayName,
          updatedAt: new Date().toISOString()
        });
      }
      
      console.log("✅ User profile updated");
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    throw error;
  }
};

// 🔹 Get user role
export const getUserRole = async (uid) => {
  try {
    const officeRef = doc(db, "offices", uid);
    const officeSnapshot = await getDoc(officeRef);
    
    if (officeSnapshot.exists()) {
      const officeData = officeSnapshot.data();
      return officeData.role || "office";
    }
    return null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
};

// 🔹 Initialize user session from stored data
export const initializeUserSession = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      // Clear any stale session data
      localStorage.removeItem("officeUser");
      localStorage.removeItem("authToken");
      return null;
    }
    
    // Get fresh office data
    const officeRef = doc(db, "offices", user.uid);
    const officeSnapshot = await getDoc(officeRef);
    
    if (!officeSnapshot.exists()) {
      // User doesn't have office record - log them out
      await logoutUser();
      return null;
    }
    
    const officeData = officeSnapshot.data();
    
    // Store in localStorage for quick access
    localStorage.setItem("officeUser", JSON.stringify({
      ...officeData,
      id: user.uid
    }));
    localStorage.setItem("authToken", "authenticated");
    localStorage.setItem("user", JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    }));
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      officeData: {
        ...officeData,
        id: user.uid
      }
    };
  } catch (error) {
    console.error("Error initializing user session:", error);
    return null;
  }
};

// 🔹 Set up auth state persistence
export const setupAuthPersistence = () => {
  console.log("✅ Auth persistence initialized");
  
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("👤 User signed in:", user.email);
      initializeUserSession();
    } else {
      console.log("👤 User signed out");
      localStorage.removeItem("officeUser");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
  });
};

// Initialize auth persistence on import
if (typeof window !== 'undefined') {
  setTimeout(() => {
    setupAuthPersistence();
  }, 1000);
}

// Export the auth instance for direct use if needed
export { auth };
