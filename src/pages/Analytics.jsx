import React, { useState, useMemo, useEffect, useRef } from "react";
import * as Chart from "chart.js/auto";
import { Download, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// ChartCard Component
const ChartCard = ({ title, subtitle, chartType = "bar", data, trend }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const chart = new Chart.Chart(ctx, {
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
        scales: chartType !== "pie" && chartType !== "doughnut" ? {
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
        } : {},
      },
    });

    return () => chart.destroy();
  }, [chartType, data]);

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

// Sample Visitor Data
const sampleVisitors = [
  { id: 1, name: "John Doe", date: "2025-11-04", satisfaction: 5, comment: "Great service!" },
  { id: 2, name: "Jane Smith", date: "2025-11-04", satisfaction: 4, comment: "Very helpful staff." },
  { id: 3, name: "Bob Wilson", date: "2025-11-03", satisfaction: 5, comment: "Excellent experience." },
  { id: 4, name: "Alice Brown", date: "2025-11-03", satisfaction: 3, comment: "Could be better." },
  { id: 5, name: "Charlie Davis", date: "2025-11-02", satisfaction: 4, comment: "Good overall." },
  { id: 6, name: "Eva Martinez", date: "2025-11-02", satisfaction: 5, comment: "Amazing!" },
  { id: 7, name: "Frank Lee", date: "2025-11-01", satisfaction: 4, comment: "Nice place." },
  { id: 8, name: "Grace Chen", date: "2025-11-01", satisfaction: 5, comment: "Highly recommend!" },
  { id: 9, name: "Henry Kim", date: "2025-10-31", satisfaction: 3, comment: "Average service." },
  { id: 10, name: "Iris Wang", date: "2025-10-31", satisfaction: 4, comment: "Pretty good." },
  { id: 11, name: "Jack Taylor", date: "2025-10-30", satisfaction: 5, comment: "Outstanding!" },
  { id: 12, name: "Kelly Moore", date: "2025-10-30", satisfaction: 4, comment: "Satisfied." },
];

// Main Analytics Component
const Analytics = () => {
  const visitors = sampleVisitors;
  const [dateRange, setDateRange] = useState("This Week");
  const user = { type: "SuperAdmin" }; // Mock user

  // 📅 Calculate Real Daily Visitor Data
  const visitorTrafficData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    if (dateRange === "This Week") {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === "This Month") {
      startDate.setDate(now.getDate() - 30);
    } else if (dateRange === "Last 3 Months") {
      startDate.setDate(now.getDate() - 90);
    }

    const filteredVisitors = visitors.filter(v => {
      const visitDate = new Date(v.date);
      return visitDate >= startDate && visitDate <= now;
    });

    const dailyCounts = {};
    filteredVisitors.forEach(v => {
      const day = new Date(v.date).toLocaleDateString('en-US', { weekday: 'short' });
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    const labels = dateRange === "This Week" 
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : Object.keys(dailyCounts);
    
    const data = labels.map(label => dailyCounts[label] || 0);

    const total = data.reduce((sum, val) => sum + val, 0);
    const lastTwo = data.slice(-2);
    const trend = lastTwo[1] > lastTwo[0] ? `+${Math.round(((lastTwo[1] - lastTwo[0]) / lastTwo[0]) * 100)}%` : 
                  lastTwo[1] < lastTwo[0] ? `-${Math.round(((lastTwo[0] - lastTwo[1]) / lastTwo[0]) * 100)}%` : "Stable";

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: "Visitors",
            data,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.3)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      trend,
      total
    };
  }, [visitors, dateRange]);

  const satisfactionData = {
    labels: ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied"],
    datasets: [
      {
        label: "Responses",
        data: [6, 4, 2, 0],
        backgroundColor: ["#16a34a", "#84cc16", "#facc15", "#ef4444"],
      },
    ],
  };

  const visitorTypeData = {
    labels: ["New Visitors", "Returning Visitors"],
    datasets: [
      {
        label: "Visitors",
        data: [65, 35],
        backgroundColor: ["#3b82f6", "#6366f1"],
      },
    ],
  };

  const peakHoursData = {
    labels: ["8AM", "10AM", "12PM", "2PM", "4PM", "6PM"],
    datasets: [
      {
        label: "Visitors per Hour",
        data: [30, 45, 70, 60, 50, 20],
        backgroundColor: "#10b981",
      },
    ],
  };

  const handleFilterChange = (e) => setDateRange(e.target.value);
  const isAdmin = user?.type === "SuperAdmin";

  const comments = visitors.map((v) => v.comment).filter(Boolean);

  const avgSatisfaction =
    visitors.reduce((sum, v) => sum + (v.satisfaction || 0), 0) /
    (visitors.length || 1);

  const integratedSummary = useMemo(() => {
    if (!comments.length) return "No visitor comments available yet.";

    let combinedText = comments.join(" ").trim();

    combinedText = combinedText
      .replace(/\s+/g, " ")
      .replace(/\s([.,!?])/g, "$1")
      .replace(/\s\s+/g, " ")
      .trim();

    combinedText = combinedText.replace(
      /(^\s*\w|[.!?]\s*\w)/g,
      (c) => c.toUpperCase()
    );

    const total = comments.length;
    return `${combinedText} Overall, ${total} visitors provided feedback with an average satisfaction rating of ${avgSatisfaction.toFixed(
      1
    )}/5.`;
  }, [comments, avgSatisfaction]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Analytics Overview
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Data insights and visitor patterns ({dateRange})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={handleFilterChange}
            className="border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-400"
          >
            <option>This Week</option>
            <option>This Month</option>
            <option>Last 3 Months</option>
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Total Visitors</p>
          <p className="text-3xl font-bold">{visitorTrafficData.total}</p>
          <p className="text-xs opacity-75 mt-2">{dateRange}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Avg Satisfaction</p>
          <p className="text-3xl font-bold">{avgSatisfaction.toFixed(1)}/5</p>
          <p className="text-xs opacity-75 mt-2">Based on {comments.length} reviews</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Trend</p>
          <p className="text-3xl font-bold">{visitorTrafficData.trend}</p>
          <p className="text-xs opacity-75 mt-2">vs previous period</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        <ChartCard
          title="📈 Visitor Traffic"
          subtitle="Daily Visits Based on Real Data"
          chartType="line"
          data={visitorTrafficData.chartData}
          trend={visitorTrafficData.trend}
        />

        <ChartCard
          title="😊 Satisfaction Rate"
          subtitle="Feedback Breakdown"
          chartType="doughnut"
          data={satisfactionData}
          trend="Stable"
        />

        <ChartCard
          title="👥 Visitor Type"
          subtitle="New vs Returning Visitors"
          chartType="pie"
          data={visitorTypeData}
          trend="+5% Returning"
        />

        {isAdmin && (
          <ChartCard
            title="🕒 Peak Visiting Hours"
            subtitle="Most Active Times"
            chartType="bar"
            data={peakHoursData}
            trend="Midday Peak"
          />
        )}
      </div>

      {/* Comment Summary Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 transition hover:shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
          💬 Integrated Visitor Comment Summary
        </h3>
        <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
          {integratedSummary}
        </p>
      </div>
    </div>
  );
};

export default Analytics;