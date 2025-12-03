import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  ChevronDown, 
  MoreHorizontal, 
  Download, 
  MessageSquare,
  Calendar,
  FileText,
  Printer
} from 'lucide-react';
import { useVisitorData } from '../data/VisitorData';

// --- Helper Functions ---
const calculateSatisfactionRates = (visitors) => {
  const total = visitors.length;
  if (total === 0) return [];

  const counts = {
    verySatisfied: visitors.filter(v => v.satisfaction >= 4.5).length,
    satisfied: visitors.filter(v => v.satisfaction >= 4.0 && v.satisfaction < 4.5).length,
    neutral: visitors.filter(v => v.satisfaction >= 3.0 && v.satisfaction < 4.0).length,
    unsatisfied: visitors.filter(v => v.satisfaction >= 2.0 && v.satisfaction < 3.0).length,
    veryUnsatisfied: visitors.filter(v => v.satisfaction < 2.0).length,
  };

  return [
    { label: 'Very Satisfied', pct: Math.round((counts.verySatisfied / total) * 100), emoji: '🤩', color: 'bg-yellow-400' },
    { label: 'Satisfied', pct: Math.round((counts.satisfied / total) * 100), emoji: '😄', color: 'bg-yellow-400' },
    { label: 'Neutral', pct: Math.round((counts.neutral / total) * 100), emoji: '😐', color: 'bg-yellow-400' },
    { label: 'Unsatisfied', pct: Math.round((counts.unsatisfied / total) * 100), emoji: '😟', color: 'bg-green-100' },
    { label: 'Very unsatisfied', pct: Math.round((counts.veryUnsatisfied / total) * 100), emoji: '😡', color: 'bg-green-100' },
  ];
};

const calculateTrafficByDay = (visitors) => {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const counts = days.map(() => 0);
  
  visitors.forEach(visitor => {
    const date = new Date(visitor.date.split('/').reverse().join('-'));
    const dayIndex = (date.getDay() + 6) % 7; // Monday=0
    counts[dayIndex]++;
  });

  const maxCount = Math.max(...counts, 1);
  
  return days.map((day, index) => ({
    day,
    value: Math.round((counts[index] / maxCount) * 100),
    count: counts[index],
    full: 100
  }));
};

// --- Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const VisitorTrafficChart = ({ trafficData }) => {
  const getBarColor = (value) => {
    if (value >= 60) return 'bg-[#6B46C1] group-hover:bg-[#5B34B8]';
    if (value >= 30) return 'bg-[#7C5CCA] group-hover:bg-[#6B46C1]';
    return 'bg-[#A48CD8] group-hover:bg-[#7C5CCA]';
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
        <div className="flex flex-col justify-between h-full text-[10px] sm:text-xs text-gray-400 pb-8 pr-2">
          <span>500</span>
          <span>400</span>
          <span>300</span>
          <span>200</span>
          <span>100</span>
          <span>0</span>
        </div>

        <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 h-full pb-8">
          {trafficData.map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1 group relative h-full">
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap">
                  {item.count} visitors
                </div>
                <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto -mt-1"></div>
              </div>

              <div className="w-full h-full flex flex-col justify-end items-center">
                <div className="relative w-4 sm:w-6 md:w-8 bg-gray-100 rounded-full overflow-hidden transition-all duration-300"
                     style={{ height: `${item.value}%` }}>
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

const SatisfactionChart = ({ ratings }) => {
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
  const { visitors } = useVisitorData();

  // --- State for date range ---
  const getDefaultDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 6); // Changed from -7 to -6 to include 7 full days
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return {
      start: formatDate(lastWeek),
      end: formatDate(today)
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    const options = { month: 'short', day: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // --- Export Functions ---
  const exportToCSV = () => {
    let csvContent = '';
    
    // Header
    csvContent += `Visitor Analytics Report\n`;
    csvContent += `Date Range: ${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Summary Statistics
    csvContent += `SUMMARY\n`;
    csvContent += `Total Visitors,${filteredVisitors.length}\n`;
    csvContent += `Average Satisfaction,${filteredVisitors.length > 0 ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2) : 0}\n\n`;
    
    // Visitor Traffic by Day
    csvContent += `VISITOR TRAFFIC BY DAY\n`;
    csvContent += `Day,Visitor Count\n`;
    trafficData.forEach(item => {
      csvContent += `${item.day},${item.count}\n`;
    });
    csvContent += `\n`;
    
    // Satisfaction Rates
    csvContent += `SATISFACTION RATES\n`;
    csvContent += `Category,Percentage,Count\n`;
    satisfactionRates.forEach(item => {
      const count = Math.round((item.pct / 100) * filteredVisitors.length);
      csvContent += `${item.label},${item.pct}%,${count}\n`;
    });
    csvContent += `\n`;
    
    // Detailed Visitor List
    csvContent += `VISITOR DETAILS\n`;
    csvContent += `Date,Name,Alias,Office,Satisfaction,Comment\n`;
    filteredVisitors.forEach(v => {
      csvContent += `${v.date},${v.name},${v.alias || ''},${v.office},${v.satisfaction},"${v.comment.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `visitor-analytics-${dateRange.start}-to-${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setShowExportMenu(false);
  };

  const exportInsightsToPDF = () => {
    // Create a temporary container for the insights content
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <div style="font-family: sans-serif; padding: 40px;">
        <h1 style="color: #1f2937; margin-bottom: 8px;">Visitor Insights Report</h1>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          Date Range: ${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}<br/>
          Generated: ${new Date().toLocaleString()}
        </p>
        
        <div style="margin-top: 32px;">
          ${filteredVisitors.map(v => `
            <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px;">
              <h3 style="color: #1f2937; margin-bottom: 8px; font-size: 16px;">
                ${v.alias || v.name} <span style="color: #6b7280; font-weight: normal;">(${v.office})</span>
              </h3>
              <p style="color: #4b5563; font-size: 14px; margin-bottom: 8px;">${v.comment}</p>
              <p style="color: #9ca3af; font-size: 12px;">${v.date} | Satisfaction: ${v.satisfaction}/5</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Store the original body content
    const originalContent = document.body.innerHTML;
    
    // Replace body with print content
    document.body.innerHTML = printContent.innerHTML;
    
    // Print
    window.print();
    
    // Restore original content
    document.body.innerHTML = originalContent;
    
    // Re-trigger React rendering by reloading (this is a workaround)
    window.location.reload();
  };

  const exportToPDF = () => {
    window.print();
    setShowExportMenu(false);
  };

  // --- Filter visitors based on date range ---
  const filteredVisitors = useMemo(() => {
    return visitors.filter(v => {
      const [day, month, year] = v.date.split('/').map(Number);
      const visitorDate = new Date(year, month - 1, day);
      visitorDate.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
      
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      
      return visitorDate >= startDate && visitorDate <= endDate;
    });
  }, [visitors, dateRange]);

  const trafficData = calculateTrafficByDay(filteredVisitors);
  const satisfactionRates = calculateSatisfactionRates(filteredVisitors);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
        }
      `}</style>
      
      <main className="flex flex-col print-section">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-gray-800">Analytics Overview</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Data insights and visitors patterns
                    <span className="hidden print:inline"> | {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}</span>
                  </p>
               </div>

               <div className="flex gap-3 items-center no-print">
                 <div className="relative">
                   <button 
                     onClick={() => setShowExportMenu(!showExportMenu)}
                     className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow text-sm font-medium text-gray-700 hover:bg-gray-50"
                   >
                     <Download size={18} className="text-gray-600" />
                     <span>Export</span>
                     <ChevronDown size={16} className="text-gray-400" />
                   </button>

                   {showExportMenu && (
                     <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 min-w-[180px]">
                       <button
                         onClick={exportToCSV}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                       >
                         <FileText size={16} className="text-gray-600" />
                         <div>
                           <div className="text-sm font-medium text-gray-800">Export CSV</div>
                           <div className="text-xs text-gray-500">Download data file</div>
                         </div>
                       </button>
                       <button
                         onClick={exportToPDF}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                       >
                         <Printer size={16} className="text-gray-600" />
                         <div>
                           <div className="text-sm font-medium text-gray-800">Print / PDF</div>
                           <div className="text-xs text-gray-500">Print or save as PDF</div>
                         </div>
                       </button>
                     </div>
                   )}
                 </div>

                 <div className="relative">
                 <button 
                   onClick={() => setShowDatePicker(!showDatePicker)}
                   className="flex gap-3 items-center bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                 >
                   <Calendar size={18} className="text-gray-500" />
                   <span className="text-sm font-medium text-gray-700">
                     {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
                   </span>
                   <ChevronDown size={16} className="text-gray-400" />
                 </button>

                 {showDatePicker && (
                   <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[320px]">
                     <div className="space-y-3">
                       <div>
                         <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                         <input 
                           type="date" 
                           className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                           value={dateRange.start} 
                           onChange={e => setDateRange({...dateRange, start: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                         <input 
                           type="date" 
                           className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
                           value={dateRange.end} 
                           onChange={e => setDateRange({...dateRange, end: e.target.value})}
                         />
                       </div>
                       <button 
                         onClick={() => setShowDatePicker(false)}
                         className="w-full bg-[#6B46C1] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[#5B34B8] transition-colors"
                       >
                         Apply
                       </button>
                     </div>
                   </div>
                 )}
               </div>
             </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="min-h-[350px]">
                <VisitorTrafficChart trafficData={trafficData} />
              </Card>
              <Card className="min-h-[350px]">
                <SatisfactionChart ratings={satisfactionRates} />
              </Card>
            </div>

            {/* Summary Stats for Print */}
            <div className="hidden print:block">
              <Card>
                <h3 className="font-bold text-lg text-gray-800 mb-4">Summary Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Visitors</p>
                    <p className="text-2xl font-bold text-gray-800">{filteredVisitors.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Satisfaction</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {filteredVisitors.length > 0 
                        ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2)
                        : '0.00'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Visitor Insights */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent no-print"></div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-gray-800">Visitor Insights</h3>
                </div>
                
                <div className="relative no-print">
                  <button 
                    onClick={exportInsightsToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg shadow-purple-200"
                  >
                    <Printer size={16} />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Insights */}
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar print:max-h-none print:overflow-visible">
                {filteredVisitors.map((visitor) => (
                  <div key={visitor.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-800">
                          {visitor.alias || visitor.name} 
                          <span className="text-gray-500 font-normal ml-2">
                            ({visitor.office})
                          </span>
                        </h4>
                        <p className="text-gray-600 text-sm mt-1">{visitor.comment}</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs">{visitor.date} | Satisfaction: {visitor.satisfaction}/5</p>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;