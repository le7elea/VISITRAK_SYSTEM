import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { getOfficeProfileForAuthUser } from "../lib/userProfile.services";

import bgImage from "../assets/patternBG.png";
import bisuLogo from "../assets/bisulogo.png";
import vtLogo from "../assets/bisulogo01.png";

const Modal = ({ show, title, message, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-6 shadow-[0_25px_60px_rgba(91,56,134,0.45)]">
        <h3 className="text-xl font-bold text-gray-800 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6 whitespace-pre-line">{message}</p>

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

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  const token = params.get("token");
  const tokenEmail = (params.get("email") || "").trim().toLowerCase();
  const isFirebaseResetFlow = mode === "resetPassword" && !!oobCode;
  const isTokenResetFlow = !!token && !!tokenEmail;

  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    redirect: null,
  });

  useEffect(() => {
    const validateCode = async () => {
      if (isTokenResetFlow) {
        setAccountEmail(tokenEmail);
        setValidating(false);
        return;
      }

      if (!isFirebaseResetFlow) {
        setModal({
          show: true,
          title: "Invalid Link",
          message: "This password reset link is invalid.",
          redirect: "/login",
        });
        setValidating(false);
        return;
      }

      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        setAccountEmail(email || "");
      } catch (error) {
        console.error("Reset code validation error:", error);
        setModal({
          show: true,
          title: "Invalid or Expired Link",
          message: "This password reset link is invalid or has expired.",
          redirect: "/login",
        });
      } finally {
        setValidating(false);
      }
    };

    validateCode();
  }, [isFirebaseResetFlow, isTokenResetFlow, oobCode, tokenEmail]);

  const rules = {
    length: newPassword.length >= 10,
    uppercase: /[A-Z]/.test(newPassword),
    special: /[0-9!@#$%^&*]/.test(newPassword),
  };

  const passwordValid = rules.length && rules.uppercase && rules.special;

  const completeTokenReset = async () => {
    const response = await fetch("/api/complete-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        email: tokenEmail,
        newPassword,
      }),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Ignore parse errors and use fallback message.
    }

    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message || "Failed to reset password.");
      error.code = payload.error || `HTTP_${response.status}`;
      throw error;
    }
  };

  const handleResetPassword = async () => {
    if (!isTokenResetFlow && !oobCode) {
      setModal({
        show: true,
        title: "Invalid Link",
        message: "Reset code is missing.",
        redirect: "/login",
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
      if (isTokenResetFlow) {
        await completeTokenReset();
      } else {
        await confirmPasswordReset(auth, oobCode, newPassword);

        try {
          if (accountEmail) {
            const loginResult = await signInWithEmailAndPassword(
              auth,
              accountEmail,
              newPassword
            );
            const officeProfile = await getOfficeProfileForAuthUser(loginResult.user);

            if (officeProfile?.id) {
              await updateDoc(doc(db, "offices", officeProfile.id), {
                passwordChanged: true,
                passwordChangedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }

            await signOut(auth);
          }
        } catch (statusError) {
          console.error("Password status sync error:", statusError);
        }
      }

      setModal({
        show: true,
        title: "Password Updated Successfully",
        message: "Your password has been reset successfully. You can now log in with your new password.",
        redirect: "/login",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      let message = "Failed to reset password. Please request a new link.";

      if (error.code === "TOKEN_EXPIRED" || error.code === "auth/expired-action-code") {
        message = "This reset link has expired. Please request a new one.";
      } else if (
        error.code === "INVALID_TOKEN" ||
        error.code === "TOKEN_EMAIL_MISMATCH" ||
        error.code === "auth/invalid-action-code"
      ) {
        message = "This reset link is invalid. Please request a new one.";
      } else if (error.code === "TOKEN_USED") {
        message = "This reset link was already used. Please request a new one.";
      } else if (error.code === "auth/weak-password") {
        message = "The new password is too weak.";
      } else if (error.code === "WEAK_PASSWORD") {
        message =
          "Password must be at least 10 characters with one uppercase and one number or special character.";
      } else if (error.code === "HTTP_404") {
        message = "Reset service route is missing. Contact administrator.";
      }

      setModal({
        show: true,
        title: "Error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B3886] mx-auto mb-4"></div>
          <p className="text-gray-600">Validating reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="w-full max-w-md px-6 pt-12 text-center">
        <div className="flex justify-center gap-3 mb-6">
          <img src={bisuLogo} alt="BISU" className="w-10 h-10" />
          <img src={vtLogo} alt="VisiTrak" className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Create New Password</h1>

        <p className="text-sm text-gray-500 mb-2">
          Please enter your new password below for your Office Admin account.
        </p>
        {accountEmail && <p className="text-xs text-gray-400 mb-8">{accountEmail}</p>}

        <div className="text-left mb-4">
          <label className="text-sm font-medium text-gray-700">New Password</label>
          <div className="relative mt-1">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="text-xs mb-6 space-y-1 text-left">
          <p className={`flex items-center ${rules.length ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.length ? "OK" : "NO"}</span>
            At least 10 characters
          </p>
          <p className={`flex items-center ${rules.uppercase ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.uppercase ? "OK" : "NO"}</span>
            Contains uppercase letter
          </p>
          <p className={`flex items-center ${rules.special ? "text-green-600" : "text-gray-500"}`}>
            <span className="mr-2">{rules.special ? "OK" : "NO"}</span>
            Contains number or special character
          </p>
        </div>

        <div className="text-left mb-8">
          <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
          <div className="relative mt-1">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          onClick={handleResetPassword}
          disabled={submitting || !passwordValid}
          className={`w-full h-12 text-white rounded-lg font-semibold transition-all duration-300 ${
            submitting || !passwordValid
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#5B3886] hover:bg-purple-800 hover:shadow-lg"
          }`}
        >
          {submitting ? "Updating..." : "Create Password"}
        </button>

        <p className="text-xs text-gray-400 mt-6">(c) 2025 VisiTrak System - BISU. All rights reserved.</p>
      </div>

      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onClose={() => {
          setModal((prev) => ({ ...prev, show: false }));
          if (modal.redirect) navigate(modal.redirect);
        }}
      />
    </div>
  );
};

export default ResetPassword;
