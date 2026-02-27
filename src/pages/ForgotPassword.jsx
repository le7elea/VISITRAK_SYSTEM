import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getOfficePasswordResetRequestStatus,
  requestOfficePasswordReset,
} from "../lib/info.services";
import bgImage from "../assets/patternBG.png";
import bisuLogo from "../assets/bisulogo.png";
import masidLogo from "../assets/bisulogo01.png";
import fgIllustrator from "../assets/fg_illustrator.png";

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
const RESET_STATUS_POLL_INTERVAL_MS = 5000;
const RESET_TRACK_USERNAME_KEY = "office_reset_tracking_username";

const Modal = ({ show, title, message, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-6 shadow-[0_25px_60px_rgba(91,56,134,0.45)] animate-scaleIn">
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

const ForgotPassword = () => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [trackedUsername, setTrackedUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem(RESET_TRACK_USERNAME_KEY) || "")
      .trim()
      .toLowerCase();
  });
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
  });

  const navigate = useNavigate();

  const loadRequestStatus = useCallback(
    async (targetUsername, options = {}) => {
      const cleanUsername = String(targetUsername || "").trim().toLowerCase();
      if (!cleanUsername || !USERNAME_REGEX.test(cleanUsername)) {
        setStatusData(null);
        return;
      }

      const showLoader = options?.showLoader === true;
      if (showLoader) {
        setStatusLoading(true);
      }

      try {
        const payload = await getOfficePasswordResetRequestStatus(cleanUsername);
        setStatusData(payload || null);
      } catch (error) {
        console.error("Status check error:", error);
      } finally {
        if (showLoader) {
          setStatusLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!trackedUsername) {
      localStorage.removeItem(RESET_TRACK_USERNAME_KEY);
      return;
    }
    localStorage.setItem(RESET_TRACK_USERNAME_KEY, trackedUsername);
  }, [trackedUsername]);

  useEffect(() => {
    if (!trackedUsername) return;
    loadRequestStatus(trackedUsername, { showLoader: true });
  }, [trackedUsername, loadRequestStatus]);

  useEffect(() => {
    if (!trackedUsername) return;

    let disposed = false;
    const pollStatus = async () => {
      if (document.visibilityState === "hidden") return;
      if (disposed) return;
      await loadRequestStatus(trackedUsername);
    };

    const intervalId = setInterval(
      pollStatus,
      RESET_STATUS_POLL_INTERVAL_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [trackedUsername, loadRequestStatus]);

  const handleResetPassword = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setModal({
        show: true,
        title: "Missing Username",
        message: "Please enter your username.",
      });
      return;
    }

    if (!USERNAME_REGEX.test(cleanUsername)) {
      setModal({
        show: true,
        title: "Invalid Username",
        message:
          "Username must be 4-32 characters and can use lowercase letters, numbers, dot, underscore, and hyphen.",
      });
      return;
    }

    setLoading(true);

    try {
      await requestOfficePasswordReset(cleanUsername);
      setTrackedUsername(cleanUsername);
      await loadRequestStatus(cleanUsername);
      setModal({
        show: true,
        title: "Request Submitted",
        message:
          `If "${cleanUsername}" exists, the super admin has been notified.\n\n` +
          "Keep this page open. Once approved, your reset link will appear automatically below.",
      });
      setUsername("");
    } catch (error) {
      console.error("Forgot password error:", error);
      setModal({
        show: true,
        title: "Request Failed",
        message: error.message || "Unable to submit reset request right now. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 py-6"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="relative bg-white rounded-2xl w-full max-w-6xl min-h-[520px] md:h-[600px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_50px_rgba(91,56,134,0.80)]">
        <div className="absolute top-4 right-4 flex gap-2 z-20">
          <img src={bisuLogo} alt="BISU Logo" className="w-7 sm:w-8 md:w-9" />
          <img src={masidLogo} alt="MASID Logo" className="w-7 sm:w-8 md:w-9" />
        </div>

        <div className="hidden md:flex md:w-1/2 items-center justify-center bg-purple-50 p-6 lg:p-10">
          <img
            src={fgIllustrator}
            alt="Forgot Password Illustration"
            className="w-full max-w-[520px] lg:max-w-[600px] xl:max-w-[650px] h-auto object-contain drop-shadow-[0_20px_40px_rgba(91,56,134,0.25)]"
          />
        </div>

        <div className="w-full md:w-1/2 px-6 sm:px-10 py-10 flex flex-col">
          <div className="flex-1">
            <div className="mb-2">
              <h2 className="text-4xl font-bold text-gray-900">Forgot Your</h2>
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Password?</h2>
            </div>

            <p className="text-gray-500 text-sm mb-10">
              Enter your registered username below and we will send a secure reset request to the super admin.
              Once approved, you can continue password reset using the one-time link.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="relative">
                <label
                  htmlFor="username"
                  className="absolute -top-2.5 left-4 bg-white px-2 text-xs font-medium text-purple-700 z-10"
                >
                  Username *
                </label>

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  disabled={loading}
                  placeholder={loading ? "Processing..." : "Enter your office username"}
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
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Submitting...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>SEND RESET REQUEST</span>
                  </div>
                )}
              </button>
            </form>

            {trackedUsername && (
              <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-purple-800">
                    Request Status: {trackedUsername}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      loadRequestStatus(trackedUsername, { showLoader: true })
                    }
                    disabled={statusLoading}
                    className="text-xs font-semibold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                  >
                    {statusLoading ? "Checking..." : "Check now"}
                  </button>
                </div>

                <p className="mt-2 text-sm text-purple-900">
                  {statusData?.status === "approved" &&
                    "Approved. You can reset your password now."}
                  {statusData?.status === "pending" &&
                    "Pending super admin approval. This updates automatically."}
                  {statusData?.status === "rejected" &&
                    "Rejected. Contact your super admin for assistance."}
                  {statusData?.status === "expired" &&
                    "Reset link expired. Submit a new request."}
                  {!statusData?.status && "Checking request status..."}
                </p>

                {statusData?.status === "approved" && statusData?.resetLink && (
                  <a
                    href={statusData.resetLink}
                    className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-[#5B3886] to-[#8B5AA8] px-5 text-sm font-semibold text-white hover:from-[#4A2D6B] hover:to-[#7A4998]"
                  >
                    RESET PASSWORD NOW
                  </a>
                )}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => navigate("/login")}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 text-gray-500 hover:text-purple-600 hover:underline transition-colors duration-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Login</span>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-400 text-center space-y-1">
              <p>Need help? Contact your system administrator</p>
              <p>(c) LMT. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default ForgotPassword;
