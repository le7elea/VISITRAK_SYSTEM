// pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  buildSessionUser,
  getOfficeProfileForAuthUser,
} from "../lib/userProfile.services";
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

  // Load remembered email only (never password).
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
      return;
    }

    // Backward compatibility for previous user storage.
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;

    try {
      const parsed = JSON.parse(savedUser);
      if (parsed?.email) {
        setEmail(parsed.email);
      }
    } catch (error) {
      console.error("Error parsing saved user:", error);
      localStorage.removeItem("user");
    }
  }, []);

  const createActivityLog = async (userData, action) => {
    try {
      const logData = {
        title: "User Login",
        description: `${userData.name} logged into the system`,
        office: userData.office,
        userId: userData.uid || userData.id,
        userEmail: userData.email,
        userRole: userData.role,
        action,
        timestamp: serverTimestamp(),
        type: "login",
      };

      await addDoc(collection(db, "activityLogs"), logData);
    } catch (error) {
      console.error("Error creating activity log:", error);
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password");
  };

  const handleLoginClick = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const authResult = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const authUser = authResult.user;

      const officeProfile = await getOfficeProfileForAuthUser(authUser);
      if (!officeProfile) {
        await signOut(auth);
        throw new Error(
          "Account profile not found in Firestore. Contact your administrator."
        );
      }

      if (officeProfile.status === "inactive") {
        await signOut(auth);
        throw new Error("Account is inactive. Please contact administrator.");
      }

      const userData = buildSessionUser(authUser, officeProfile);
      await createActivityLog(userData, "login");

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", normalizedEmail);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      localStorage.setItem("user", JSON.stringify(userData));

      if (onLogin) {
        onLogin(userData);
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Login failed. Please try again.";
      if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account is disabled.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Check your connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
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
