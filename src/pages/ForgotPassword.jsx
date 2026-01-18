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

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1️⃣ Check if email exists in offices
      const exists = await checkEmailExists(normalizedEmail);

      if (!exists) {
        setModal({
          show: true,
          title: "Email Not Found",
          message:
            "This email is not registered in the VisiTrak system. Please check and try again.",
        });
        setLoading(false);
        return;
      }

      // 2️⃣ Call Firebase Cloud Function (SendGrid)
      const response = await fetch(
        "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/sendPasswordResetEmail",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send reset email");
      }

      // 3️⃣ Success modal
      setModal({
        show: true,
        title: "Email Sent",
        message:
          "A password reset link has been sent to your email. Please check your inbox.",
      });

      setLoading(false);

    } catch (error) {
      console.error("Forgot password error:", error);
      setModal({
        show: true,
        title: "Error",
        message: "Something went wrong. Please try again later.",
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
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mt-12">
              Forgot
            </h2>
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Your Password?
            </h2>

            <p className="text-gray-500 text-sm mb-10">
              Enter your email address and we’ll send you a link to reset your password.
            </p>

            <div className="relative mb-6">
              <label className="absolute -top-2.5 left-4 bg-white px-2 text-xs font-medium text-purple-700">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full h-14 px-4 rounded-xl border border-purple-300 focus:ring-4 focus:ring-purple-200 outline-none disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full h-14 bg-[#5B3886] hover:bg-purple-800 text-white rounded-lg font-semibold flex items-center justify-center disabled:opacity-50"
            >
              {loading ? "Sending..." : "RESET PASSWORD"}
            </button>

            <button
              onClick={() => navigate("/login")}
              className="mt-4 text-sm text-gray-400 hover:underline w-full"
            >
              ← Back to login
            </button>
          </div>

          <div className="mt-auto pt-4 border-t text-xs text-gray-400 text-center">
            © 2025 LMT. All rights reserved.
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal({ ...modal, show: false })}
      />
    </div>
  );
};

export default ForgotPassword;
