import React from "react";

const ProfileCard = ({ avatar, name, role, location, status }) => {
  return (
    <div className="relative bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-purple-200 dark:border-gray-700 mb-6 flex items-center gap-4">
      {/* Avatar and user info */}
      <div className="flex items-center gap-4">
        <img
          src={avatar}
          alt="Avatar"
          className="w-20 h-20 rounded-full border-2 border-purple-300"
        />
        <div>
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-gray-500 dark:text-gray-400">{role}</p>
          <p className="text-gray-500 dark:text-gray-400">{location}</p>
        </div>
      </div>

      {/* Status at top-right */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {status === "Active" && (
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
        )}
        <span
          className={`text-sm font-medium ${
            status === "Active" ? "text-green-500" : "text-red-500"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
};

export default ProfileCard;
