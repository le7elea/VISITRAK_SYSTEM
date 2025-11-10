import React from "react";

const Dropdown = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full h-11 border border-gray-300 rounded-md px-3 text-gray-700 bg-gray-50 cursor-pointer outline-none"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export default Dropdown;
