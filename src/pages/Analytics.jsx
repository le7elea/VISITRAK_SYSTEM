import React from 'react';
import { 
  BarChart2, 
  ChevronDown, 
  MoreHorizontal, 
  Download, 
  MessageSquare 
} from 'lucide-react';


// --- Components ---

// 1. Sidebar Item Component
const SidebarItem = ({ icon: Icon, label, isActive, badge }) => (
  <button
    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors mb-1 ${
      isActive
        ? 'bg-[#6B46C1] text-white shadow-md'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </div>
    {badge && (
      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

// 2. Section Header
const SectionHeader = ({ title }) => (
  <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 px-4 mt-6">
    {title}
  </h3>
);

// 3. Card Component (Reusable Container)
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

// 4. Bar Chart Component (Custom CSS Implementation)
const VisitorTrafficChart = () => {
  const data = [
    { day: 'MON', value: 30, full: 100 },
    { day: 'TUE', value: 50, full: 100 },
    { day: 'WED', value: 65, full: 100 },
    { day: 'THU', value: 45, full: 100 },
    { day: 'FRI', value: 55, full: 100 },
    { day: 'SAT', value: 25, full: 100 },
    { day: 'SUN', value: 10, full: 100 },
  ];

  const getBarColor = (value) => {
    if (value >= 60) return 'bg-[#6B46C1] group-hover:bg-[#5B34B8]'; // Darker purple
    if (value >= 30) return 'bg-[#7C5CCA] group-hover:bg-[#6B46C1]'; // Original purple
    return 'bg-[#A48CD8] group-hover:bg-[#7C5CCA]'; // Lighter purple
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-[#6B46C1]" size={20} />
          <h3 className="font-bold text-gray-800">Visitor Traffic</h3>
        </div>
        <MoreHorizontal className="text-gray-400 cursor-pointer" />
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 h-64">
        {/* Y-Axis Labels (Simplified) - Now visible on all screens */}
        <div className="flex flex-col justify-between h-full text-[10px] sm:text-xs text-gray-400 pb-8 pr-2">
          <span>500</span>
          <span>400</span>
          <span>300</span>
          <span>200</span>
          <span>100</span>
          <span>0</span>
        </div>

        {/* Bars Container */}
        <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 h-full pb-8">
          {data.map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1 group relative h-full">
              
              {/* Percentage Tooltip (Visible on Hover) */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap">
                  {item.value}%
                </div>
                {/* Tooltip Arrow */}
                <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto -mt-1"></div>
              </div>

              {/* Bar Container */}
              <div className="w-full h-full flex flex-col justify-end items-center">
                <div className="relative w-4 sm:w-6 md:w-8 bg-gray-100 rounded-full overflow-hidden transition-all duration-300"
                     style={{ height: `${item.value}%` }}>
                   {/* Active Bar */}
                   <div 
                    className={`absolute inset-0 w-full rounded-full transition-all duration-500 ${getBarColor(item.value)}`}
                   ></div>
                </div>
              </div>
              
              <span className="text-[10px] text-gray-400 mt-2 font-medium absolute -bottom-6">{item.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. Satisfaction Chart Component  

const SatisfactionChart = () => {
  const ratings = [
    { label: 'Very Satisfied', pct: 95, emoji: '🤩', color: 'bg-yellow-400' },
    { label: 'Satisfied', pct: 92, emoji: '😄', color: 'bg-yellow-400' },
    { label: 'Neutral', pct: 89, emoji: '😐', color: 'bg-yellow-400' },
    { label: 'Unsatisfied', pct: 48, emoji: '😟', color: 'bg-green-100' }, // Image showed lighter colors for lower
    { label: 'Very unsatisfied', pct: 15, emoji: '😡', color: 'bg-green-100' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100">
             <span className="text-xs">⚖️</span> 
          </div>
          <h3 className="font-bold text-gray-800">Satisfaction Rate</h3>
        </div>
        <MoreHorizontal className="text-gray-400 cursor-pointer" />
      </div>

      <div className="flex flex-col gap-5 justify-center h-full">
        {ratings.map((item, idx) => (
          <div key={idx} className="w-full">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-lg">{item.emoji}</span>
              <span className="text-xs font-bold text-gray-700 w-24">{item.label}</span>
              <div className="flex-1 h-2 bg-green-50 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full ${idx < 3 ? 'bg-yellow-400' : 'bg-[#D1FADF]'}`}
                  style={{ width: `${item.pct}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-gray-600 w-8 text-right">{item.pct}%</span>
              <span className="text-[10px] text-gray-300 hidden sm:block">Rate</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Application ---

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* Main Content */}
      <main className="flex flex-col">
        {/* Dashboard Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Title Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-gray-800">Analytics Overview</h2>
                  <p className="text-gray-500 text-sm mt-1">Data insights and visitors patterns</p>
               </div>
               <button className="flex items-center justify-between gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-shadow shadow-sm min-w-[140px]">
                 <span>This Week</span>
                 <ChevronDown size={16} />
               </button>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="min-h-[350px]">
                <VisitorTrafficChart />
              </Card>
              <Card className="min-h-[350px]">
                <SatisfactionChart />
              </Card>
            </div>

            {/* Insights Card */}
            <Card className="relative overflow-hidden">
               {/* Decorative top border line */}
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>
               
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
                       <MessageSquare size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800">Visitor Insights</h3>
                 </div>
                 <button className="flex items-center gap-2 px-4 py-2 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg shadow-purple-200">
                    <Download size={16} />
                    <span>Export PDF</span>
                 </button>
               </div>

               <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                    Great service! Very helpful staff. Excellent experience. Could be better. Good overall. Amazing! Nice place. Highly recommend! Average service. Pretty good. Outstanding! Satisfied. Overall, 12 visitors provided feedback with an average satisfaction rating of <span className="font-bold text-[#6B46C1]">4.3/5</span>.
                  </p>
               </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;