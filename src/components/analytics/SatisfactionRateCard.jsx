import { MoreHorizontal } from "lucide-react";

const SatisfactionRateCard = ({ ratings }) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-800">Satisfaction Rate</h3>
        <MoreHorizontal className="text-gray-400" />
      </div>

      {ratings.length === 0 ? (
        <p className="text-center text-gray-500">No satisfaction data</p>
      ) : (
        <div className="space-y-4">
          {ratings.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <span>{r.emoji}</span>
              <span className="w-24 text-sm font-medium">{r.label}</span>
              <div className="flex-1 bg-gray-100 h-2 rounded-full">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="text-sm font-bold">{r.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default SatisfactionRateCard;
