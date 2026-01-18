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
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-6 shadow-[0_25px_60px_rgba(91,56,134,0.45)] animate-scaleIn">
        <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
          {title}
        </h3>

        <p className="text-sm text-gray-500 text-center mb-6">
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

  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetData, setResetData] = useState(null);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    redirect: null,
  });

  const navigate = useNavigate();

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
        setLoading(false);
        return;
      }

      try {
        const result = await validatePasswordResetToken(token);

        if (!result) {
          setModal({
            show: true,
            title: "Invalid or Expired Link",
            message:
              "This password reset link is invalid or has already expired.",
            redirect: "/login",
          });
          setLoading(false);
          return;
        }

        setResetData(result);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setModal({
          show: true,
          title: "Error",
          message: "Something went wrong while validating the reset link.",
          redirect: "/login",
        });
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  /* =============================
     Handle Password Reset
  ============================= */
  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setModal({
        show: true,
        title: "Weak Password",
        message: "Password must be at least 6 characters long.",
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
      setLoading(true);

      // 1️⃣ Update office password
      await updateOfficePasswordByEmail(resetData.email, newPassword);

      // 2️⃣ Mark token as used
      await markPasswordResetTokenUsed(resetData.id);

      // 3️⃣ Activity log (optional but recommended)
      await createPasswordResetActivityLog(resetData.email);

      setModal({
        show: true,
        title: "Password Updated",
        message: "Your password has been reset successfully.",
        redirect: "/login",
      });

      setLoading(false);
    } catch (error) {
      console.error(error);
      setModal({
        show: true,
        title: "Error",
        message: "Failed to reset password. Please try again.",
      });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Validating reset link...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Reset Password
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Enter your new password below.
        </p>

        <div className="mb-4">
          <label className="text-sm font-medium text-purple-700">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-12 px-4 mt-1 rounded-lg border border-purple-300 focus:ring-4 focus:ring-purple-200 outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-purple-700">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-12 px-4 mt-1 rounded-lg border border-purple-300 focus:ring-4 focus:ring-purple-200 outline-none"
          />
        </div>

        <button
          onClick={handleResetPassword}
          disabled={loading}
          className="w-full h-12 bg-[#5B3886] hover:bg-purple-800 text-white rounded-lg font-semibold transition disabled:opacity-50"
        >
          {loading ? "Updating..." : "UPDATE PASSWORD"}
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
