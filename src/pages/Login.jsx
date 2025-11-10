import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import bisuLogo from "../assets/bisulogo.png";
import masidLogo from "../assets/logo02.png";
import emailIcon from "../assets/email.png";
import passwordIcon from "../assets/password.png";
import eyeOpen from "../assets/eye_open.png";
import eyeClosed from "../assets/eye_closed.png";
import illustrator from "../assets/illustrator.png";
import bgImage from "../assets/BG12.png";

import InputField from "../components/InputField";
import Dropdown from "../components/Dropdown";
import RememberForgot from "../components/RememberForgot";

const Login = ({ onLogin }) => {
  const [userType, setUserType] = useState("SuperAdmin");
  const [selectedOffice, setSelectedOffice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUserType(parsed.type || "SuperAdmin");
      setSelectedOffice(parsed.office || "");
      setEmail(parsed.email || "");
      setPassword(parsed.password || "");
      setRememberMe(true);
    }
  }, []);
 
  const handleForgotPassword = () => {
    const enteredEmail = prompt("🔑 Enter your registered email:");
    if (enteredEmail)
      alert(`📧 A password reset link has been sent to: ${enteredEmail}`);
  };

  const handleLoginClick = (e) => {
    e.preventDefault();
    if (!email || !password)
      return alert("⚠️ Please enter email and password.");

    if (
      userType === "SuperAdmin" &&
      (email !== "superadmin@gmail.com" || password !== "12345")
    )
      return alert("❌ Invalid Super Admin credentials!");

    if (userType === "OfficeAdmin") {
      if (!selectedOffice) return alert("⚠️ Please select an office.");
      if (email !== "officeadmin@gmail.com" || password !== "12345")
        return alert("❌ Invalid Office Admin credentials!");
    }

    if (rememberMe)
      localStorage.setItem(
        "user",
        JSON.stringify({ type: userType, office: selectedOffice, email, password })
      );
    else localStorage.removeItem("user");

    if (onLogin) onLogin({ type: userType, office: selectedOffice, email });

    navigate("/dashboard"); 
  };

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen pt-10 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* 🌟 Logo Section */}
      <div className="flex flex-col items-center mb-6 mt-5">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <img src={bisuLogo} alt="BISU Logo" className="w-20" />
          <img src={masidLogo} alt="MASID Logo" className="w-20" />
        </div>
        <p className="text-white text-3xl font-semibold mt-4 mb-5">Hello, Welcome!</p>
      </div>

      {/* 🪪 Login + Illustration */}
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
          />

          <InputField
            icon={passwordIcon}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            rightIcon={showPassword ? eyeOpen : eyeClosed}
            onRightIconClick={() => setShowPassword(!showPassword)}
          />

          <RememberForgot
            rememberMe={rememberMe}
            onRememberChange={setRememberMe}
            onForgot={handleForgotPassword}
          />

          {/* Dropdowns */}
          <div
            className={`flex ${
              userType === "OfficeAdmin" ? "flex-col sm:flex-row gap-3" : "flex-col"
            }`}
          >
            <Dropdown
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              options={[
                { value: "SuperAdmin", label: "Super Admin" },
                { value: "OfficeAdmin", label: "Office Admin" },
              ]}
            />

            {userType === "OfficeAdmin" && (
              <Dropdown
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                options={[
                  { value: "", label: "-- Select Office --" },
                  { value: "CCIS Office", label: "CCIS Office" },
                  { value: "CTAS Office", label: "CTAS Office" },
                  { value: "CCJ Office", label: "CCJ Office" },
                  { value: "Clinic", label: "Clinic" },
                  { value: "Registrar", label: "Registrar Office" },
                ]}
              />
            )}
          </div>

          <button
            onClick={handleLoginClick}
            className="w-full bg-purple-700 text-white rounded-md h-12 mt-5 font-semibold hover:bg-purple-800 transition"
          >
            Login
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
