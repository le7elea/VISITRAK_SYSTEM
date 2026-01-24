import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  validatePasswordResetToken,
  updateOfficePasswordByEmail,
  markPasswordResetTokenUsed,
  createPasswordResetActivityLog,
} from "../lib/info.services";

import bgImage from "../assets/patternBG.png";
import bisuLogo from "../assets/bisulogo.png";
import vtLogo from "../assets/bisulogo01.png";

/* =============================
   Modal Component
============================= */
const Modal = ({ show, title, message, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-6 shadow-[0_25px_60px_rgba(91,56,134,0.45)]">
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
   Reset Password Page - FIXED VERSION
============================= */
const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [resetData, setResetData] = useState(null);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    redirect: null,
  });

  /* =============================
     Validate Token - FIXED VERSION
  ============================= */
  useEffect(() => {
    const validateToken = async () => {
      console.log("🔗 URL Parameters:", { 
        token: token?.substring(0, 20) + (token?.length > 20 ? '...' : ''),
        email: email?.substring(0, 30) + (email?.length > 30 ? '...' : ''),
        tokenLength: token?.length,
        emailLength: email?.length
      });

      if (!token) {
        setModal({
          show: true,
          title: "Invalid Link",
          message: "Reset token is missing from the URL.",
          redirect: "/login",
        });
        setValidating(false);
        return;
      }

      if (!email) {
        setModal({
          show: true,
          title: "Invalid Link",
          message: "Email address is missing from reset link.",
          redirect: "/login",
        });
        setValidating(false);
        return;
      }

      try {
        // IMPORTANT: Token should be passed as-is, react-router already decoded it
        const cleanToken = token;
        
        // Decode email (it might be URL-encoded)
        let cleanEmail = email;
        try {
          cleanEmail = decodeURIComponent(email).trim().toLowerCase();
        } catch (e) {
          cleanEmail = email.trim().toLowerCase();
        }
        
        console.log("🔍 Validating with:", { 
          token: cleanToken.substring(0, 20) + '...',
          email: cleanEmail 
        });

        // Validate token with email
        console.log("🔄 Calling validatePasswordResetToken...");
        const result = await validatePasswordResetToken(cleanToken, cleanEmail);

        if (!result) {
          setModal({
            show: true,
            title: "Invalid or Expired Link",
            message: "This password reset link is invalid, expired, or already used.",
            redirect: "/login",
          });
          setValidating(false);
          return;
        }

        console.log("✅ Token validated successfully:", {
          id: result.id,
          email: result.email,
          officeName: result.officeName,
          expiresAt: result.expiresAt?.toISOString(),
          used: result.used
        });

        setResetData(result);
        setValidating(false);
      } catch (error) {
        console.error("❌ Token validation error:", error);
        setModal({
          show: true,
          title: "Error",
          message: "Failed to validate reset link. Please try again or request a new link.",
          redirect: "/login",
        });
        setValidating(false);
      }
    };

    validateToken();
  }, [token, email]);

  /* =============================
     Password Rules
  ============================= */
  const rules = {
    length: newPassword.length >= 10,
    uppercase: /[A-Z]/.test(newPassword),
    special: /[0-9!@#$%^&*]/.test(newPassword),
  };

  const passwordValid = rules.length && rules.uppercase && rules.special;

  /* =============================
     Submit Reset Password
  ============================= */
  const handleResetPassword = async () => {
    if (!resetData) {
      setModal({
        show: true,
        title: "Error",
        message: "Reset data not available. Please refresh the page.",
      });
      return;
    }

    if (!passwordValid) {
      setModal({
        show: true,
        title: "Weak Password",
        message:
          "Password must be at least 10 characters, contain 1 uppercase letter, and 1 number or special character.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setModal({
        show: true,
        title: "Password Mismatch",
        message: "Passwords do not match.",
      });
      return;
    }

    try {
      setSubmitting(true);
      console.log("🔄 Resetting password for:", resetData.email);

      // 1. Update password in offices collection
      await updateOfficePasswordByEmail(resetData.email, newPassword);
      
      // 2. Mark token as used
      await markPasswordResetTokenUsed(resetData.id);
      
      // 3. Create activity log
      await createPasswordResetActivityLog(resetData.email);

      console.log("✅ Password reset completed successfully");

      setModal({
        show: true,
        title: "Password Updated Successfully",
        message: "Your password has been reset successfully. You can now login with your new password.",
        redirect: "/login",
      });

      setSubmitting(false);
    } catch (error) {
      console.error("❌ Reset password error:", error);
      setModal({
        show: true,
        title: "Error",
        message: error.message || "Failed to reset password. Please try again.",
      });
      setSubmitting(false);
    }
  };

  /* =============================
     Loading State
  ============================= */
  if (validating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B3886] mx-auto mb-4"></div>
          <p className="text-gray-600">Validating reset link...</p>
          <p className="text-sm text-gray-500 mt-2">
            Token: {token ? `${token.substring(0, 10)}...` : 'none'}<br/>
            Email: {email ? email.substring(0, 20) + (email.length > 20 ? '...' : '') : 'none'}
          </p>
        </div>
      </div>
    );
  }

  /* =============================
     Render UI
  ============================= */
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* CONTENT */}
      <div className="w-full max-w-md px-6 pt-12 text-center">
        {/* Logos */}
        <div className="flex justify-center gap-3 mb-6">
          <img src={bisuLogo} alt="BISU" className="w-10 h-10" />
          <img src={vtLogo} alt="VisiTrak" className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold mb-2">
          Create New Password
        </h1>

        <p className="text-sm text-gray-500 mb-8">
          Please enter your new password below for your Office Admin account.
        </p>


        {/* New Password */}
        <div className="text-left mb-4">
          <label className="text-sm font-medium text-gray-700">
            New Password
          </label>
          <div className="relative mt-1">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter new password"
              disabled={!resetData}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={!resetData}
            >
              {showNew ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* Password Rules */}
        <div className="text-xs mb-6 space-y-1 text-left">
          <p className={`flex items-center ${rules.length ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.length ? "✅" : "❌"}</span>
            At least 10 characters
          </p>
          <p className={`flex items-center ${rules.uppercase ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.uppercase ? "✅" : "❌"}</span>
            Contains uppercase letter
          </p>
          <p className={`flex items-center ${rules.special ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.special ? "✅" : "❌"}</span>
            Contains number or special character
          </p>
        </div>

        {/* Confirm Password */}
        <div className="text-left mb-8">
          <label className="text-sm font-medium text-gray-700">
            Confirm New Password
          </label>
          <div className="relative mt-1">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Confirm new password"
              disabled={!resetData}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={!resetData}
            >
              {showConfirm ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleResetPassword}
          disabled={submitting || !passwordValid || !resetData}
          className={`w-full h-12 text-white rounded-lg font-semibold transition-all duration-300 ${
            submitting || !passwordValid || !resetData
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#5B3886] hover:bg-purple-800 hover:shadow-lg"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
          ) : (
            "Create Password"
          )}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          © 2025 VisiTrak System - BISU. All rights reserved.
        </p>
      </div>

      {/* Success/Error Modal */}
      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onClose={() => {
          setModal({ ...modal, show: false });
          if (modal.redirect) navigate(modal.redirect);
        }}
      />
    </div>
  );
};

export default ResetPassword;