import React from "react";

const EmptyState = ({ message = "No records found" }) => {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
};

export default EmptyState;
