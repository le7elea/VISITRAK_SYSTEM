import React from "react";

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b last:border-b-0 border-gray-200 dark:border-gray-700">
    <p className="text-gray-400 dark:text-gray-500">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
); 

export default InfoRow;
