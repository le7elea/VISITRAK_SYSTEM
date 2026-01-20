// pages/ForgotPassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkEmailExists } from "../lib/info.services";

import bgImage from "../assets/patternBG.png";
import bisuLogo from "../assets/bisulogo.png";
import masidLogo from "../assets/bisulogo01.png";
import fgIllustrator from "../assets/fg_illustrator.png";

/* =============================
   Modal Component
============================= */
const Modal = ({ show, title, message, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-6 shadow-[0_25px_60px_rgba(91,56,134,0.45)] animate-scaleIn">
        <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
          {title}
        </h3>

        <p className="text-sm text-gray-500 text-center mb-6 whitespace-pre-line">
          {message}
        </p>

        <button
          onClick={onClose}
          className="w-full h-11 bg-[#5B3886] hover:bg-purple-800 text-white rounded-lg font-semibold transition"
        >
          OK
        </button>
      </div>
    </div>
  );
};

/* =============================
   Forgot Password Page
============================= */
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
  });

  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!email) {
      setModal({
        show: true,
        title: "Missing Email",
        message: "Please enter your email address.",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setModal({
        show: true,
        title: "Invalid Email",
        message: "Please enter a valid email address (e.g., example@domain.com).",
      });
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1️⃣ Check if email exists in offices
      const exists = await checkEmailExists(normalizedEmail);

      if (!exists) {
        setModal({
          show: true,
          title: "Email Not Found",
          message: "This email is not registered in the VisiTrak system.",
        });
        setLoading(false);
        return;
      }

      // 2️⃣ Call Vercel Serverless Function
      const API_URL = "/api/send-password-reset";

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      // Get response text first (more reliable than .json())
      const responseText = await response.text();
      let responseData = {};

      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
        }
      }

      if (!response.ok) {
        const errorMsg = responseData.message || 
                         responseData.error || 
                         `Request failed (Status: ${response.status})`;
        throw new Error(errorMsg);
      }

      // 3️⃣ Handle different response modes
      if (responseData.mode === 'simulation') {
        // Simulation mode (firebase-admin not installed or not working)
        setModal({
          show: true,
          title: "⚠️ Development Mode",
          message: `Password reset simulation complete.\n\nEmail: ${normalizedEmail}\n\nNote: Check Firebase Admin configuration.`,
        });
      } else if (responseData.mode === 'token_only') {
        // Token generated but email not sent (SendGrid not configured)
        setModal({
          show: true,
          title: "Token Generated",
          message: `Reset token created.\n\nConfigure SendGrid to enable email sending.`,
        });
      } else {
        // ✅ SUCCESS - Email actually sent (production mode)
        setModal({
          show: true,
          title: "✓ Email Sent Successfully",
          message: `Password reset link has been sent to:\n${normalizedEmail}\n\nPlease check your inbox (and spam folder).\nThe link will expire in 15 minutes.`,
        });
        
        // Clear form only on success
        setEmail("");
      }

      setLoading(false);

    } catch (error) {
      console.error("Forgot password error:", error);
      
      // User-friendly error messages
      let errorMessage = "Something went wrong. Please try again later.";
      let errorTitle = "Error";
      
      if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        errorTitle = "Connection Error";
        errorMessage = "Cannot connect to the server. Please check your internet connection.";
      } else if (error.message.includes("405")) {
        errorTitle = "Service Error";
        errorMessage = "Password reset service is temporarily unavailable.";
      } else if (error.message.includes("404")) {
        errorTitle = "Service Unavailable";
        errorMessage = "Password reset service is not available at the moment.";
      } else if (error.message.includes("Email not found") || 
                 error.message.includes("not registered") || 
                 error.message.includes("EMAIL_NOT_FOUND")) {
        errorTitle = "Email Not Found";
        errorMessage = "This email is not registered in our system.";
      } else if (error.message.includes("500") || error.message.includes("Internal Server")) {
        errorTitle = "Server Error";
        errorMessage = "An internal server error occurred. Please try again later.";
      } else if (error.message.includes("Firebase Admin initialization")) {
        errorTitle = "Configuration Error";
        errorMessage = "Authentication service not configured properly.";
      }
      
      setModal({
        show: true,
        title: errorTitle,
        message: errorMessage,
      });
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 py-6"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="relative bg-white rounded-2xl w-full max-w-6xl min-h-[520px] md:h-[600px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_50px_rgba(91,56,134,0.80)]">

        {/* Logos */}
        <div className="absolute top-4 right-4 flex gap-2 z-20">
          <img src={bisuLogo} alt="BISU Logo" className="w-7 sm:w-8 md:w-9" />
          <img src={masidLogo} alt="MASID Logo" className="w-7 sm:w-8 md:w-9" />
        </div>

        {/* Illustration */}
        <div className="hidden md:flex md:w-1/2 items-center justify-center bg-purple-50 p-6 lg:p-10">
          <img
            src={fgIllustrator}
            alt="Forgot Password Illustration"
            className="w-full max-w-[520px] lg:max-w-[600px] xl:max-w-[650px] h-auto object-contain drop-shadow-[0_20px_40px_rgba(91,56,134,0.25)]"
          />
        </div>

        {/* Form */}
        <div className="w-full md:w-1/2 px-6 sm:px-10 py-10 flex flex-col">
          <div className="flex-1">
            <div className="mb-2">
              <h2 className="text-4xl font-bold text-gray-900">
                Forgot Your
              </h2>
              <h2 className="text-4xl font-bold text-gray-900 mb-3">
                Password?
              </h2>
            </div>

            <p className="text-gray-500 text-sm mb-10">
              Enter your registered email address below and we'll send you a secure link to reset your password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="relative">
                <label 
                  htmlFor="email"
                  className="absolute -top-2.5 left-4 bg-white px-2 text-xs font-medium text-purple-700 z-10"
                >
                  Email Address *
                </label>
                
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder={loading ? "Processing..." : "Enter your registered email address"}
                  className="w-full h-14 px-4 rounded-xl border border-purple-300 focus:ring-4 focus:ring-purple-200 focus:border-purple-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-gradient-to-r from-[#5B3886] to-[#8B5AA8] hover:from-[#4A2D6B] hover:to-[#7A4998] text-white rounded-lg font-semibold flex items-center justify-center disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center space-x-3">
                    <svg 
                      className="animate-spin h-5 w-5 text-white" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Sending Reset Link...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>SEND RESET LINK</span>
                  </div>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => navigate("/login")}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 text-gray-500 hover:text-purple-600 hover:underline transition-colors duration-200 disabled:opacity-50"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Back to Login</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-400 text-center space-y-1">
              <p>Need help? Contact your system administrator</p>
              <p>© 2025 VisiTrak System. BISU - MASID. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onClose={() => {
          setModal({ ...modal, show: false });
          // If success modal, navigate back to login after delay
          if (modal.title.includes("Email Sent Successfully")) {
            setTimeout(() => navigate("/login"), 300);
          }
        }}
      />
    </div>
  );
};

export default ForgotPassword;