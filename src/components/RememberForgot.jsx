import React from "react";

const RememberForgot = ({ rememberMe, onRememberChange, onForgot }) => (
  <div className="flex justify-between items-center text-sm text-gray-800 mb-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={rememberMe}
        onChange={(e) => onRememberChange(e.target.checked)}
        className="accent-purple-700"
      />
      <span>Remember me</span>
    </label>
    <span
      onClick={onForgot}
      className="text-purple-700 font-semibold cursor-pointer hover:underline"
    >
      Forgot password?
    </span>
  </div>
);

export default RememberForgot;
