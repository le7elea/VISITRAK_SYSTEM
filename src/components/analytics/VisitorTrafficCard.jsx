import { BarChart2, MoreHorizontal } from "lucide-react";

const VisitorTrafficCard = ({ trafficData }) => {
  const totalVisitors = trafficData.reduce((sum, d) => sum + d.count, 0);

  const getBarColor = (value, count) => {
    if (count === 0) return "bg-gray-200";
    if (value >= 60) return "bg-[#6B46C1]";
    if (value >= 30) return "bg-[#7C5CCA]";
    return "bg-[#A48CD8]";
  };

  if (totalVisitors === 0) {
    return (
      <>
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="text-[#6B46C1]" size={20} />
          <h3 className="font-bold text-gray-800">Visitor Traffic</h3>
        </div>
        <div className="text-center text-gray-500 py-10">
          <BarChart2 size={48} className="mx-auto text-gray-300 mb-3" />
          <p>No visitors during this period</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-[#6B46C1]" size={20} />
          <h3 className="font-bold text-gray-800">Visitor Traffic</h3>
        </div>
        <MoreHorizontal className="text-gray-400" />
      </div>

      <div className="flex items-end gap-4 h-64">
        {trafficData.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className={`w-6 rounded-full transition-all ${getBarColor(
                item.value,
                item.count
              )}`}
              style={{ height: `${item.count ? item.value : 5}%` }}
            />
            <span className="text-xs text-gray-400 mt-2">{item.day}</span>
          </div>
        ))}
      </div>
    </>
  );
};

export default VisitorTrafficCard;
