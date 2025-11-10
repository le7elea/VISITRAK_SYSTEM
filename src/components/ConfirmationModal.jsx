import React from "react";
import Button from "./Button";

const ConfirmationModal = ({ title, message, onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-[90%] max-w-md animate-fadeIn">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {title}
        </h4>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Yes, Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
