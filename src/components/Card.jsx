import React from "react";

const Card = ({ title, children }) => {
  return (
    <div className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm">
      {title && (
        <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
};

export default Card;
