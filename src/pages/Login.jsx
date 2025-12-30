// pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import bisuLogo from "../assets/bisulogo.png";
import masidLogo from "../assets/logo02.png";
import emailIcon from "../assets/email.png";
import passwordIcon from "../assets/password.png";
import eyeOpen from "../assets/eye_open.png";
import eyeClosed from "../assets/eye_closed.png";
import illustrator from "../assets/illustrator.png";
import bgImage from "../assets/BG12.png";
import InputField from "../components/InputField";
import RememberForgot from "../components/RememberForgot";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load saved credentials
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setEmail(parsed.email || "");
      setPassword(parsed.password || "");
      setRememberMe(true);
    }
  }, []);

  // Function to create activity log
  const createActivityLog = async (userData, action) => {
    try {
      const logData = {
        title: "User Login",
        description: `${userData.name} logged into the system`,
        office: userData.office, // This is CRITICAL - must match Profile.jsx query
        userId: userData.id,
        userEmail: userData.email,
        userRole: userData.role,
        action: action,
        timestamp: serverTimestamp(),
        type: "login"
      };

      await addDoc(collection(db, "activityLogs"), logData);
      console.log("✅ Activity log created for:", userData.office);
    } catch (error) {
      console.error("❌ Error creating activity log:", error);
    }
  };

  const handleForgotPassword = () => {
    const enteredEmail = prompt("🔑 Enter your registered email:");
    if (enteredEmail)
      alert(`📧 A password reset link has been sent to: ${enteredEmail}`);
  };

  const handleLoginClick = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert("⚠️ Please enter email and password.");
    
    setLoading(true);

    try {
      const officesRef = collection(db, "offices");
      const q = query(officesRef, where("email", "==", email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("❌ Email not found in database!");
        setLoading(false);
        return;
      }

      const userDoc = snapshot.docs[0].data();
      const docId = snapshot.docs[0].id;

      if (password !== userDoc.password) {
        alert("❌ Invalid password!");
        setLoading(false);
        return;
      }

      // 🔹 Create complete user data object
      const userData = {
        email: email.toLowerCase(),
        name: userDoc.name,
        type: userDoc.role === "super" ? "SuperAdmin" : "OfficeAdmin",
        office: userDoc.name, // This is the office name from Firestore
        role: userDoc.role,
        id: docId,
        password: password, // Store for password verification in Profile.jsx
        isInDatabase: true,
        // Store both name and office separately for clarity
        officeName: userDoc.name
      };

      console.log("✅ Login successful, user data:", userData);

      // 🔹 Create login activity log
      await createActivityLog(userData, "login");

      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify({ 
          email, 
          password, 
          ...userData 
        }));
      } else {
        localStorage.setItem("user", JSON.stringify({
          ...userData,
          password: undefined // Don't store password if not remembering
        }));
      }

      // Call onLogin callback if provided
      if (onLogin) onLogin(userData);

      // Navigate to profile
      navigate("/profile");

    } catch (error) {
      console.error("Login error:", error);
      alert("❌ Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen pt-10 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Logo Section */}
      <div className="flex flex-col items-center mb-6 mt-5">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <img src={bisuLogo} alt="BISU Logo" className="w-20" />
          <img src={masidLogo} alt="MASID Logo" className="w-20" />
        </div>
        <p className="text-white text-3xl font-semibold mt-4 mb-5">Hello, Welcome!</p>
      </div>

      {/* Login + Illustration */}
      <div className="relative flex flex-col lg:flex-row items-center justify-center gap-10 w-full px-6">
        {/* Login Card */}
        <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px] text-center z-10 transition-all duration-300">
          <h2 className="text-2xl font-bold text-purple-800 mb-2">LOGIN</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Welcome back! Please login to admin dashboard
          </p>

          <InputField
            icon={emailIcon}
            type="email"
            placeholder="Email / Username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <InputField
            icon={passwordIcon}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            rightIcon={showPassword ? eyeOpen : eyeClosed}
            onRightIconClick={() => setShowPassword(!showPassword)}
            disabled={loading}
          />

          <RememberForgot
            rememberMe={rememberMe}
            onRememberChange={setRememberMe}
            onForgot={handleForgotPassword}
            disabled={loading}
          />

          <button
            onClick={handleLoginClick}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-700 to-purple-900 text-white rounded-md h-12 mt-5 font-semibold hover:from-purple-800 hover:to-purple-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Logging in...
              </span>
            ) : "Login"}
          </button>

          {/* Debug info (remove in production) */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-left text-xs text-gray-600 hidden">
            <p><strong>Debug Info:</strong></p>
            <p>Email: {email}</p>
            <p>Office field will be set to: {email.split('@')[0] || 'office_name'}</p>
          </div>
        </div>

        {/* Illustration */}
        <div className="lg:absolute lg:right-60 lg:top-[-100px] flex justify-center mt-6 lg:mt-0">
          <img
            src={illustrator}
            alt="Illustration"
            className="h-130 sm:h-140 lg:h-150 object-contain animate-bounce-slow"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;