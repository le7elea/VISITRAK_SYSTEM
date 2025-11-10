import React from "react";
import Button from "./Button";

const OfficeCard = ({
  office,
  index,
  isEditing,
  editName,
  setEditName,
  onEdit,
  onSave,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-transform hover:-translate-y-1">
      <div className="mb-3">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        ) : (
          <>
            <strong className="block text-lg text-gray-900 dark:text-gray-100">
              {office.name}
            </strong>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              ID: {office.id}
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        {isEditing ? (
          <Button variant="warning" onClick={() => onSave(index)} className="flex-1">
            💾 Save
          </Button>
        ) : (
          <Button variant="success" onClick={() => onEdit(index)} className="flex-1">
            ✏ Edit
          </Button>
        )}
        <Button variant="danger" onClick={() => onDelete(index)} className="flex-1">
          🗑 Delete
        </Button>
      </div>
    </div>
  );
};

export default OfficeCard;
