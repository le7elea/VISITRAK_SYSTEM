import React from "react";
import { X } from "lucide-react";

const formatRating = (value) => {
  const numeric = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}/5` : "N/A";
};

const FeedbackModal = ({ isOpen, onClose, visitor }) => {
  if (!isOpen || !visitor) return null;

  const questionRatings = Array.isArray(visitor.questionRatings)
    ? visitor.questionRatings
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg relative flex flex-col max-h-[75vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close feedback details"
        >
          <X size={20} />
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 break-words">
            Feedback Details{" "}
            <span className="text-sm text-gray-500">({visitor.office || "Unspecified"})</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">{visitor.date}</p>
          <p className="text-sm font-medium text-yellow-600 mt-2">
            Overall Rating: {formatRating(visitor.satisfaction)}
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Commendation</h4>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg break-words">
              <p className="text-gray-700 whitespace-pre-line">
                {visitor.commendation || "No commendation provided."}
              </p>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Suggestion</h4>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg break-words">
              <p className="text-gray-700 whitespace-pre-line">
                {visitor.suggestion || "No suggestion provided."}
              </p>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Rating Per Question</h4>
            {questionRatings.length > 0 ? (
              <ul className="space-y-2">
                {questionRatings.map((item, index) => (
                  <li
                    key={`${item.question || "question"}-${index}`}
                    className="flex items-start justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <p className="text-sm text-gray-700 flex-1">
                      {item.question || `Question ${index + 1}`}
                    </p>
                    <p className="text-sm font-semibold text-yellow-600 whitespace-nowrap">
                      {formatRating(item.rating)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-500">
                  Question-level ratings are not available for this feedback.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
