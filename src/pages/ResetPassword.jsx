// pages/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  validatePasswordResetToken,
  updateOfficePasswordByEmail,
  markPasswordResetTokenUsed,
  createPasswordResetActivityLog,
} from "../lib/info.services";

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

  // States
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
     Validate Token on Load
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
        console.log("Reset token result:", result);

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
      } catch (error) {
        console.error("Token validation error:", error);
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
     Handle Password Reset
  ============================= */
  const handleResetPassword = async () => {
    if (!passwordValid) {
      setModal({
        show: true,
        title: "Weak Password",
        message:
          "Password must be at least 10 characters long, contain 1 uppercase letter, and 1 number or special character.",
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
    } catch (error) {
      console.error(error);
      setModal({
        show: true,
        title: "Error",
        message: "Failed to reset password. Please try again.",
      });
      setSubmitting(false);
    }
  };

  /* =============================
     Loading Screen
  ============================= */
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Validating reset link...
      </div>
    );
  }

  /* =============================
     UI
  ============================= */
  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create New Password
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Please enter your new password below.
        </p>

        {/* New Password */}
        <div className="mb-4">
          <label className="text-sm font-medium text-purple-700">
            New Password
          </label>
          <div className="relative mt-1">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-12 px-4 pr-10 rounded-lg border border-purple-300 focus:ring-4 focus:ring-purple-200 outline-none"
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

        {/* Password Rules */}
        <div className="text-xs mb-4 space-y-1">
          <p className={rules.length ? "text-green-600" : "text-gray-500"}>
            • At least 10 characters
          </p>
          <p className={rules.uppercase ? "text-green-600" : "text-gray-500"}>
            • 1 uppercase letter
          </p>
          <p className={rules.special ? "text-green-600" : "text-gray-500"}>
            • 1 number or special character
          </p>
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <label className="text-sm font-medium text-purple-700">
            Confirm Password
          </label>
          <div className="relative mt-1">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 px-4 pr-10 rounded-lg border border-purple-300 focus:ring-4 focus:ring-purple-200 outline-none"
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
          className="w-full h-12 bg-[#5B3886] hover:bg-purple-800 text-white rounded-lg font-semibold transition disabled:opacity-50"
        >
          {submitting ? "Updating..." : "CREATE PASSWORD"}
        </button>
      </div>

      {/* Modal */}
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
