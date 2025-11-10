import React from "react";

const InputField = ({
  icon,
  type,
  placeholder,
  value,
  onChange,
  rightIcon,
  onRightIconClick,
}) => {
  return (
    <div className="flex items-center border border-gray-300 rounded-md bg-gray-50 px-3 mb-3 relative w-full sm:w-80 md:w-full max-w-md transition-all duration-300">
      <img src={icon} alt="" className="w-5 h-5 opacity-70" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="flex-1 h-11 px-3 text-gray-700 bg-transparent outline-none text-[15px]"
      />
      {rightIcon && (
        <img
          src={rightIcon}
          alt="toggle"
          className="w-5 h-5 absolute right-3 cursor-pointer opacity-70 hover:opacity-100"
          onClick={onRightIconClick}
        />
      )}
    </div>
  );
};

export default InputField;
