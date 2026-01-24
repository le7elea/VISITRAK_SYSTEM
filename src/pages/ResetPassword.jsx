// pages/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  validatePasswordResetToken,
  updateOfficePasswordByEmail,
  markPasswordResetTokenUsed,
  createPasswordResetActivityLog,
} from "../lib/info.services";

// 👉 replace with your actual logos
import bisuLogo from "../assets/bisulogo.png";
import vtLogo from "../assets/vtlogo.png";

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
   Reset Password Page
============================= */
const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
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
     Validate Token
  ============================= */
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setModal({
          show: true,
          title: "Invalid Link",
          message: "Reset token is missing.",
          redirect: "/login",
        });
        setValidating(false);
        return;
      }

      try {
        const result = await validatePasswordResetToken(token);

        if (!result) {
          setModal({
            show: true,
            title: "Invalid or Expired Link",
            message:
              "This password reset link is invalid, expired, or already used.",
            redirect: "/login",
          });
          setValidating(false);
          return;
        }

        setResetData(result);
        setValidating(false);
      } catch {
        setModal({
          show: true,
          title: "Error",
          message: "Failed to validate reset link.",
          redirect: "/login",
        });
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  /* =============================
     Password Rules
  ============================= */
  const rules = {
    length: newPassword.length >= 10,
    uppercase: /[A-Z]/.test(newPassword),
    special: /[0-9!@#$%^&*]/.test(newPassword),
  };

  const passwordValid =
    rules.length && rules.uppercase && rules.special;

  /* =============================
     Submit
  ============================= */
  const handleResetPassword = async () => {
    if (!passwordValid) {
      setModal({
        show: true,
        title: "Weak Password",
        message:
          "Password must be at least 10 characters, include 1 uppercase letter, and 1 number or special character.",
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
      await updateOfficePasswordByEmail(resetData.email, newPassword);
      await markPasswordResetTokenUsed(resetData.id);
      await createPasswordResetActivityLog(resetData.email);

      setModal({
        show: true,
        title: "Password Updated",
        message: "Your password has been reset successfully.",
        redirect: "/login",
      });
      setSubmitting(false);
    } catch {
      setModal({
        show: true,
        title: "Error",
        message: "Failed to reset password.",
      });
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Validating reset link...
      </div>
    );
  }

  /* =============================
     UI (DESIGN MATCH)
  ============================= */
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between overflow-hidden">
      {/* Top */}
      <div className="w-full max-w-md px-6 pt-12 text-center">
        <div className="flex justify-center gap-3 mb-6">
          <img src={bisuLogo} alt="BISU" className="w-10 h-10" />
          <img src={vtLogo} alt="VT" className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Create new password</h1>
        <p className="text-sm text-gray-500 mb-8">
          Please enter your new password below for your Office Admin account.
        </p>

        {/* New Password */}
        <div className="text-left mb-4">
          <label className="text-sm font-medium">New Password</label>
          <div className="relative mt-1">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              👁
            </button>
          </div>
        </div>

        {/* Rules */}
        <div className="text-xs text-gray-600 mb-6 space-y-1 text-left">
          <p>• 10 characters</p>
          <p>• 1 uppercase</p>
          <p>• 1 number or special character (example: # ? ! &)</p>
        </div>

        {/* Confirm */}
        <div className="text-left mb-8">
          <label className="text-sm font-medium">Confirm new Password</label>
          <div className="relative mt-1">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              👁
            </button>
          </div>
        </div>

        <button
          onClick={handleResetPassword}
          disabled={submitting}
          className="w-full h-12 bg-[#5B3886] text-white rounded-lg font-semibold hover:bg-purple-800 transition"
        >
          {submitting ? "Updating..." : "Create Password"}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          © 2025 LMT. All rights reserved.
        </p>
      </div>

      {/* Bottom wave */}
      <div className="w-full h-40 bg-[#5B3886] rounded-t-[100%]" />

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
