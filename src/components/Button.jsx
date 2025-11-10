import React from "react";
import clsx from "clsx";

const Button = ({ children, onClick, variant = "primary", className }) => {
  const styles = clsx(
    "px-4 py-2 rounded-lg text-sm font-medium text-white transition-transform duration-200",
    {
      "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md": variant === "primary",
      "bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md": variant === "success",
      "bg-amber-500 hover:bg-amber-600 shadow-sm hover:shadow-md": variant === "warning",
      "bg-red-600 hover:bg-red-700 shadow-sm hover:shadow-md": variant === "danger",
      "bg-gray-600 hover:bg-gray-700": variant === "neutral",
    },
    className
  );

  return (
    <button onClick={onClick} className={styles}>
      {children}
    </button>
  );
};

export default Button;
