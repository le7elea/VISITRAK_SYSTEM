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
    today.setHours(0, 0, 0, 0);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 6);
    
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
  const [showIntegratedModal, setShowIntegratedModal] = useState(false);
  const [showOverallModal, setShowOverallModal] = useState(false);

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    const options = { month: 'short', day: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // --- Export Functions ---
  const exportToCSV = () => {
    const avgSat = filteredVisitors.length > 0 
      ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2)
      : 0;

    // Create proper CSV content
    let csvContent = '';
    
    // Header
    csvContent += 'VISITOR ANALYTICS REPORT\n';
    csvContent += `Date Range:,${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}\n`;
    csvContent += `Generated:,${new Date().toLocaleString()}\n`;
    csvContent += '\n';
    
    // Summary Statistics
    csvContent += 'SUMMARY STATISTICS\n';
    csvContent += 'Total Visitors,' + filteredVisitors.length + '\n';
    csvContent += 'Average Satisfaction,' + avgSat + ' / 5.0\n';
    csvContent += '\n';
    
    // Visitor Traffic by Day
    csvContent += 'VISITOR TRAFFIC BY DAY\n';
    csvContent += 'Day,Visitor Count,Chart\n';
    
    const maxTrafficCount = Math.max(...trafficData.map(d => d.count), 1);
    trafficData.forEach(item => {
      const barWidth = Math.round((item.count / maxTrafficCount) * 20);
      const bars = '█'.repeat(barWidth);
      csvContent += `${item.day},${item.count},${bars}\n`;
    });
    csvContent += '\n';
    
    // Satisfaction Rates
    csvContent += 'SATISFACTION RATE DISTRIBUTION\n';
    csvContent += 'Category,Emoji,Percentage,Count,Chart\n';
    
    satisfactionRates.forEach(item => {
      const count = Math.round((item.pct / 100) * filteredVisitors.length);
      const barWidth = Math.round(item.pct / 5);
      const bars = '█'.repeat(barWidth);
      csvContent += `${item.label},${item.emoji},${item.pct}%,${count},${bars}\n`;
    });
    csvContent += '\n';
    
    // Visitor Details
    csvContent += 'DETAILED VISITOR FEEDBACK\n';
    csvContent += 'Date,Name,Alias,Office,Rating,Stars,Comment\n';
    
    filteredVisitors.forEach(v => {
      const ratingStars = '★'.repeat(Math.round(v.satisfaction)) + '☆'.repeat(5 - Math.round(v.satisfaction));
      const comment = v.comment.replace(/"/g, '""'); // Escape quotes for CSV
      csvContent += `${v.date},${v.name},${v.alias || '-'},${v.office},${v.satisfaction}/5,${ratingStars},"${comment}"\n`;
    });

    // Create blob and download as CSV
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
    const narrative = generateIntegratedNarrative();
    
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <div style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #1f2937; margin-bottom: 8px; font-size: 28px; border-bottom: 3px solid #6B46C1; padding-bottom: 12px;">
          Integrated Visitor Insights Report
        </h1>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">
          Date Range: ${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}<br/>
          Generated: ${new Date().toLocaleString()}<br/>
          Total Visitors: ${filteredVisitors.length}
        </p>
        
        <div style="margin-top: 24px; line-height: 1.8; color: #374151; font-size: 15px;">
          ${narrative.split('\n').map(line => line.trim() ? `<p style="margin-bottom: 16px; text-align: justify;">${line}</p>` : '').join('')}
        </div>
      </div>
    `;
    
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const exportToPDF = () => {
    window.print();
    setShowExportMenu(false);
  };

  const exportOverallToPDF = () => {
    const narrative = generateOverallNarrative();
    
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <div style="font-family: sans-serif; padding: 40px; max-width: 900px; margin: 0 auto;">
        <h1 style="color: #1f2937; margin-bottom: 8px; font-size: 32px; border-bottom: 4px solid #6B46C1; padding-bottom: 16px;">
          Analytics Overview Report
        </h1>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 40px;">
          Comprehensive Analysis | ${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}<br/>
          Generated: ${new Date().toLocaleString()}<br/>
          Total Visitors: ${filteredVisitors.length} | Average Satisfaction: ${filteredVisitors.length > 0 ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2) : '0.00'}/5.0
        </p>
        
        <div style="margin-top: 24px; line-height: 1.8; color: #374151; font-size: 15px;">
          ${narrative.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('# ')) {
              return `<h1 style="color: #1f2937; font-size: 28px; margin-top: 32px; margin-bottom: 16px; font-weight: bold;">${trimmed.substring(2)}</h1>`;
            }
            if (trimmed.startsWith('## ')) {
              return `<h2 style="color: #374151; font-size: 22px; margin-top: 28px; margin-bottom: 12px; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${trimmed.substring(3)}</h2>`;
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return `<p style="margin-bottom: 12px; font-weight: bold; color: #1f2937;">${trimmed.replace(/\*\*/g, '')}</p>`;
            }
            if (trimmed.startsWith('- ')) {
              return `<li style="margin-left: 20px; margin-bottom: 8px;">${trimmed.substring(2)}</li>`;
            }
            return `<p style="margin-bottom: 16px; text-align: justify;">${trimmed}</p>`;
          }).join('')}
        </div>
      </div>
    `;
    
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // --- Filter visitors based on date range ---
  const filteredVisitors = useMemo(() => {
    return visitors.filter(v => {
      const [day, month, year] = v.date.split('/').map(Number);
      const visitorDate = new Date(year, month - 1, day);
      visitorDate.setHours(0, 0, 0, 0);
      
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      return visitorDate >= startDate && visitorDate <= endDate;
    });
  }, [visitors, dateRange]);

  const trafficData = calculateTrafficByDay(filteredVisitors);
  const satisfactionRates = calculateSatisfactionRates(filteredVisitors);

  // Generate integrated narrative
  const generateIntegratedNarrative = () => {
    const avgSat = filteredVisitors.length > 0 
      ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2)
      : 0;
    
    let narrative = `During the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, our facility recorded ${filteredVisitors.length} visitor${filteredVisitors.length !== 1 ? 's' : ''} with an average satisfaction rating of ${avgSat} out of 5. `;
    
    if (filteredVisitors.length > 0) {
      narrative += `The feedback received reveals valuable insights into visitor experiences across different offices. `;
      
      const highSat = filteredVisitors.filter(v => v.satisfaction >= 4.0);
      const mediumSat = filteredVisitors.filter(v => v.satisfaction >= 3.0 && v.satisfaction < 4.0);
      const lowSat = filteredVisitors.filter(v => v.satisfaction < 3.0);
      
      if (highSat.length > 0) {
        narrative += `${highSat.length} visitor${highSat.length !== 1 ? 's' : ''} expressed high satisfaction (4.0+), highlighting positive experiences. `;
      }
      
      if (mediumSat.length > 0) {
        narrative += `${mediumSat.length} provided neutral feedback (3.0-3.9), suggesting room for improvement. `;
      }
      
      if (lowSat.length > 0) {
        narrative += `${lowSat.length} indicated concerns with lower satisfaction scores (below 3.0), requiring attention. `;
      }
      
      narrative += `\n\nKey observations from individual visitor feedback:\n\n`;
      
      filteredVisitors.forEach((v, idx) => {
        narrative += `${idx + 1}. ${v.alias || v.name} from ${v.office} (${v.date}) rated their experience ${v.satisfaction}/5: "${v.comment}"\n\n`;
      });
    }
    
    return narrative;
  };

  // Generate overall analytics narrative
  const generateOverallNarrative = () => {
    const avgSat = filteredVisitors.length > 0 
      ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2)
      : 0;
    
    let narrative = `# Executive Summary\n\nThis comprehensive analytics report covers the period from ${formatDateDisplay(dateRange.start)} to ${formatDateDisplay(dateRange.end)}, providing insights into visitor traffic patterns, satisfaction rates, and individual feedback.\n\n`;
    
    // Overview Section
    narrative += `## Overview\n\nDuring this reporting period, our facility welcomed ${filteredVisitors.length} visitor${filteredVisitors.length !== 1 ? 's' : ''}, achieving an overall average satisfaction rating of ${avgSat} out of 5.0. This represents a ${avgSat >= 4.0 ? 'strong' : avgSat >= 3.0 ? 'moderate' : 'developing'} level of visitor satisfaction across all touchpoints.\n\n`;
    
    // Traffic Analysis
    narrative += `## Visitor Traffic Analysis\n\n`;
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const maxTrafficDay = trafficData.reduce((max, day) => day.count > max.count ? day : max, trafficData[0]);
    const minTrafficDay = trafficData.reduce((min, day) => day.count < min.count ? day : min, trafficData[0]);
    const totalVisits = trafficData.reduce((sum, day) => sum + day.count, 0);
    
    narrative += `Traffic distribution throughout the week shows varying patterns of visitor engagement. `;
    
    if (maxTrafficDay.count > 0) {
      const dayName = daysOfWeek[trafficData.indexOf(maxTrafficDay)];
      narrative += `${dayName} recorded the highest traffic with ${maxTrafficDay.count} visitor${maxTrafficDay.count !== 1 ? 's' : ''}, `;
      
      if (minTrafficDay.count === 0) {
        const minDayName = daysOfWeek[trafficData.indexOf(minTrafficDay)];
        narrative += `while ${minDayName} saw no visitor activity. `;
      } else if (minTrafficDay.count < maxTrafficDay.count) {
        const minDayName = daysOfWeek[trafficData.indexOf(minTrafficDay)];
        narrative += `while ${minDayName} had the lowest with ${minTrafficDay.count} visitor${minTrafficDay.count !== 1 ? 's' : ''}. `;
      }
    }
    
    const weekdayTotal = trafficData.slice(0, 5).reduce((sum, day) => sum + day.count, 0);
    const weekendTotal = trafficData.slice(5, 7).reduce((sum, day) => sum + day.count, 0);
    
    if (totalVisits > 0) {
      const weekdayPct = Math.round((weekdayTotal / totalVisits) * 100);
      const weekendPct = Math.round((weekendTotal / totalVisits) * 100);
      narrative += `Weekday visits accounted for ${weekdayPct}% of total traffic, with weekend visits comprising ${weekendPct}%.\n\n`;
    }
    
    // Satisfaction Analysis
    narrative += `## Satisfaction Rate Analysis\n\n`;
    
    const verySatisfied = satisfactionRates.find(r => r.label === 'Very Satisfied');
    const satisfied = satisfactionRates.find(r => r.label === 'Satisfied');
    const neutral = satisfactionRates.find(r => r.label === 'Neutral');
    const unsatisfied = satisfactionRates.find(r => r.label === 'Unsatisfied');
    const veryUnsatisfied = satisfactionRates.find(r => r.label === 'Very unsatisfied');
    
    const positivePct = (verySatisfied?.pct || 0) + (satisfied?.pct || 0);
    const negativePct = (unsatisfied?.pct || 0) + (veryUnsatisfied?.pct || 0);
    
    narrative += `Our satisfaction metrics reveal a comprehensive picture of visitor experiences. `;
    
    if (positivePct > 0) {
      narrative += `${positivePct}% of visitors expressed positive satisfaction (satisfied or very satisfied), `;
    }
    
    if (neutral?.pct > 0) {
      narrative += `${neutral.pct}% remained neutral, `;
    }
    
    if (negativePct > 0) {
      narrative += `and ${negativePct}% indicated dissatisfaction. `;
    }
    
    narrative += `\n\nBreaking down the satisfaction categories:\n`;
    satisfactionRates.forEach(rate => {
      if (rate.pct > 0) {
        const count = Math.round((rate.pct / 100) * filteredVisitors.length);
        narrative += `- ${rate.label}: ${rate.pct}% (${count} visitor${count !== 1 ? 's' : ''})\n`;
      }
    });
    
    narrative += `\n`;
    
    // Key Insights Section
    if (filteredVisitors.length > 0) {
      narrative += `## Key Visitor Insights\n\n`;
      
      const highSat = filteredVisitors.filter(v => v.satisfaction >= 4.0);
      const lowSat = filteredVisitors.filter(v => v.satisfaction < 3.0);
      
      if (highSat.length > 0) {
        narrative += `**Positive Highlights:** ${highSat.length} visitor${highSat.length !== 1 ? 's' : ''} provided high satisfaction ratings (4.0+), representing ${Math.round((highSat.length / filteredVisitors.length) * 100)}% of all responses. `;
        
        const topComment = highSat.sort((a, b) => b.satisfaction - a.satisfaction)[0];
        narrative += `Notably, ${topComment.alias || topComment.name} from ${topComment.office} gave the highest rating of ${topComment.satisfaction}/5, commenting: "${topComment.comment}"\n\n`;
      }
      
      if (lowSat.length > 0) {
        narrative += `**Areas for Improvement:** ${lowSat.length} visitor${lowSat.length !== 1 ? 's' : ''} indicated lower satisfaction levels (below 3.0), representing ${Math.round((lowSat.length / filteredVisitors.length) * 100)}% of responses. `;
        
        const criticalComment = lowSat.sort((a, b) => a.satisfaction - b.satisfaction)[0];
        narrative += `Critical feedback from ${criticalComment.alias || criticalComment.name} (${criticalComment.office}) highlighted: "${criticalComment.comment}"\n\n`;
      }
      
      // Office-based analysis
      const officeGroups = {};
      filteredVisitors.forEach(v => {
        if (!officeGroups[v.office]) {
          officeGroups[v.office] = [];
        }
        officeGroups[v.office].push(v);
      });
      
      const offices = Object.keys(officeGroups);
      if (offices.length > 1) {
        narrative += `**Office Distribution:** Visitors represented ${offices.length} different office${offices.length !== 1 ? 's' : ''}: `;
        offices.forEach((office, idx) => {
          const officeAvg = (officeGroups[office].reduce((sum, v) => sum + v.satisfaction, 0) / officeGroups[office].length).toFixed(2);
          narrative += `${office} (${officeGroups[office].length} visitor${officeGroups[office].length !== 1 ? 's' : ''}, avg: ${officeAvg})`;
          if (idx < offices.length - 1) narrative += ', ';
        });
        narrative += `.\n\n`;
      }
    }
    
    // Recommendations
    narrative += `## Recommendations\n\n`;
    
    if (negativePct > 20) {
      narrative += `- **Priority Action Required:** With ${negativePct}% negative feedback, immediate attention should be given to addressing visitor concerns and improving service quality.\n`;
    }
    
    if (neutral?.pct > 25) {
      narrative += `- **Enhancement Opportunities:** The ${neutral.pct}% neutral feedback suggests opportunities to elevate the visitor experience from satisfactory to excellent.\n`;
    }
    
    if (maxTrafficDay.count > minTrafficDay.count * 2) {
      narrative += `- **Resource Optimization:** Consider adjusting staffing and resources to better accommodate the significant traffic variations between peak and off-peak days.\n`;
    }
    
    if (positivePct >= 70) {
      narrative += `- **Maintain Excellence:** With ${positivePct}% positive satisfaction, continue current best practices while addressing remaining improvement areas.\n`;
    }
    
    narrative += `\n## Conclusion\n\nThis reporting period demonstrates ${avgSat >= 4.0 ? 'strong visitor engagement and satisfaction' : avgSat >= 3.0 ? 'steady visitor engagement with room for enhancement' : 'developing visitor engagement requiring focused improvements'}. Continued monitoring of these metrics will ensure sustained quality of visitor experiences and inform strategic decisions for facility management.`;
    
    return narrative;
  };

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
                     onClick={() => setShowOverallModal(true)}
                     className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white rounded-lg shadow-lg hover:shadow-xl transition-all text-sm font-medium"
                   >
                     <BarChart2 size={18} />
                     <span>Overall Integration</span>
                   </button>
                 </div>

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
                           <div className="text-xs text-gray-500">Download with charts (.csv)</div>
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
                    onClick={() => setShowIntegratedModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg shadow-purple-200"
                  >
                    <FileText size={16} />
                    <span>Integrate</span>
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

        {/* Integrated Insights Modal */}
        {showIntegratedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Integrated Visitor Insights</h2>
                    <p className="text-purple-100 text-sm">
                      {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)} | {filteredVisitors.length} Total Visitors
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowIntegratedModal(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose max-w-none">
                  {generateIntegratedNarrative().split('\n').map((paragraph, idx) => {
                    if (!paragraph.trim()) return null;
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-4 text-justify">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowIntegratedModal(false)}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={exportInsightsToPDF}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#553C9A] text-white rounded-lg text-sm font-medium hover:bg-[#44307B] transition-colors shadow-lg"
                  >
                    <Printer size={16} />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overall Analytics Integration Modal */}
        {showOverallModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#6B46C1] via-[#553C9A] to-[#6B46C1] text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                      <BarChart2 size={28} />
                      Overall Analytics Integration
                    </h2>
                    <p className="text-purple-100 text-sm">
                      Comprehensive Report | {formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}
                    </p>
                    <p className="text-purple-200 text-xs mt-1">
                      {filteredVisitors.length} Total Visitors | Avg Satisfaction: {filteredVisitors.length > 0 ? (filteredVisitors.reduce((sum, v) => sum + v.satisfaction, 0) / filteredVisitors.length).toFixed(2) : '0.00'}/5.0
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowOverallModal(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose max-w-none">
                  {generateOverallNarrative().split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1 key={idx} className="text-3xl font-bold text-gray-900 mt-8 mb-4 first:mt-0">
                          {trimmed.substring(2)}
                        </h1>
                      );
                    }
                    
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2 key={idx} className="text-2xl font-bold text-gray-800 mt-6 mb-3 pb-2 border-b-2 border-gray-200">
                          {trimmed.substring(3)}
                        </h2>
                      );
                    }
                    
                    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                      return (
                        <p key={idx} className="font-bold text-gray-900 mb-2 mt-4">
                          {trimmed.replace(/\*\*/g, '')}
                        </p>
                      );
                    }
                    
                    if (trimmed.startsWith('- ')) {
                      return (
                        <li key={idx} className="text-gray-700 leading-relaxed mb-2 ml-6">
                          {trimmed.substring(2)}
                        </li>
                      );
                    }
                    
                    return (
                      <p key={idx} className="text-gray-700 leading-relaxed mb-4 text-justify">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowOverallModal(false)}
                      className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={exportOverallToPDF}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#6B46C1] to-[#553C9A] text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                    >
                      <Download size={16} />
                      <span>Export Report</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;