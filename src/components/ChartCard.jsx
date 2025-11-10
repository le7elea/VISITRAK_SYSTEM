import React, { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const ChartCard = ({ title, subtitle, chartType = "bar", data, trend }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const chart = new Chart(ctx, {
      type: chartType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: document.documentElement.classList.contains("dark")
                ? "#e5e7eb"
                : "#111827",
            },
          },
          tooltip: {
            backgroundColor: "#1f2937",
            titleColor: "#fff",
            bodyColor: "#d1d5db",
            borderWidth: 1,
            borderColor: "#374151",
          },
        },
        scales: {
          x: {
            ticks: {
              color: document.documentElement.classList.contains("dark")
                ? "#e5e7eb"
                : "#111827",
            },
            grid: {
              color: "rgba(156,163,175,0.2)",
            },
          },
          y: {
            ticks: {
              color: document.documentElement.classList.contains("dark")
                ? "#e5e7eb"
                : "#111827",
            },
            grid: {
              color: "rgba(156,163,175,0.2)",
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [chartType, data]);

  // 📊 Trend Icon logic
  const TrendIcon =
    trend?.includes("+") ? ArrowUpRight : trend?.includes("-") ? ArrowDownRight : Minus;
  const trendColor = trend?.includes("+")
    ? "text-green-500"
    : trend?.includes("-")
    ? "text-red-500"
    : "text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>

        {/* 🔺 Trend Indicator */}
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
            <TrendIcon size={16} />
            {trend}
          </div>
        )}
      </div>

      <div className="h-64">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};

export default ChartCard;
 