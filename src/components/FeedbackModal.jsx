// src/components/FeedbackModal.jsx
import React from "react";
import { X } from "lucide-react";

const FeedbackModal = ({ isOpen, onClose, visitor }) => {
  if (!isOpen || !visitor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg relative flex flex-col max-h-[60vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 break-words">
            {visitor.name}{" "}
            <span className="text-sm text-gray-500">({visitor.office})</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">{visitor.date}</p>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg break-words">
            <p className="text-gray-700 whitespace-pre-line">
              {visitor.comment || "No feedback provided."}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 text-right">
          <span className="text-yellow-500 font-semibold">
            ⭐ {visitor.satisfaction?.toFixed(1) || "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
