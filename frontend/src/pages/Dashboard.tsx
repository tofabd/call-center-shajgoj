import React, { useState } from 'react';
import TodayStatistics from '@/components/Dashboard/TodayStatistics';
import WeeklyStatistics from '@/components/Dashboard/WeeklyStatistics';
import MonthlyStatistics from '@/components/Dashboard/MonthlyStatistics';
import CustomRangeModal from '@/components/Dashboard/CustomRangeModal';
import CustomRangeStatistics from '@/components/Dashboard/CustomRangeStatistics';
import CallDirectionPieChart from '@/components/Dashboard/CallDirectionPieChart';
import CallStatusPieChart from '@/components/Dashboard/CallStatusPieChart';
import IncomingCallAnalysisPieChart from '@/components/Dashboard/IncomingCallAnalysisPieChart';
import OutgoingCallAnalysisPieChart from '@/components/Dashboard/OutgoingCallAnalysisPieChart';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [isCustomRangeModalOpen, setIsCustomRangeModalOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);

  const tabs = [
    { key: 'today', label: 'Today', icon: '📅' },
    { key: 'week', label: 'This Week', icon: '📊' },
    { key: 'month', label: 'This Month', icon: '🗓️' },
    { key: 'custom', label: 'Custom Range', icon: '🎯' }
  ] as const;

  const handleTabClick = (tabKey: 'today' | 'week' | 'month' | 'custom') => {
    if (tabKey === 'custom') {
      setActiveTab('custom');
      setIsCustomRangeModalOpen(true);
    } else {
      setActiveTab(tabKey);
    }
  };

  const handleRefresh = () => {
    // Refresh callback for components
    console.log('Dashboard refresh triggered');
  };

  const handleDateRangeSelected = (dateRange: DateRange) => {
    setCustomDateRange(dateRange);
    setActiveTab('custom');
    setIsCustomRangeModalOpen(false);
  };

  const closeCustomRangeModal = () => {
    setIsCustomRangeModalOpen(false);
  };

  const openCustomRangeModal = () => {
    setIsCustomRangeModalOpen(true);
  };

  return (
    <div className="space-y-8 p-6">
      {/* Time Period Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tabs.map((tab, index) => {
          const colors = [
            { // Today - Warm amber
              bg: activeTab === tab.key 
                ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/20 dark:via-orange-900/15 dark:to-yellow-900/10' 
                : 'bg-gradient-to-br from-amber-50/40 to-orange-50/30 dark:from-amber-900/10 dark:to-orange-900/5',
              border: activeTab === tab.key 
                ? 'border-amber-300 dark:border-amber-600' 
                : 'border-amber-200/50 dark:border-amber-800/30',
              text: activeTab === tab.key 
                ? 'text-amber-800 dark:text-amber-200' 
                : 'text-gray-800 dark:text-gray-200',
              accent: 'from-amber-400 to-orange-400',
              shadow: 'shadow-amber-200/50 dark:shadow-amber-900/20'
            },
            { // Week - Cool emerald  
              bg: activeTab === tab.key 
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-900/20 dark:via-teal-900/15 dark:to-green-900/10' 
                : 'bg-gradient-to-br from-emerald-50/40 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/5',
              border: activeTab === tab.key 
                ? 'border-emerald-300 dark:border-emerald-600' 
                : 'border-emerald-200/50 dark:border-emerald-800/30',
              text: activeTab === tab.key 
                ? 'text-emerald-800 dark:text-emerald-200' 
                : 'text-gray-800 dark:text-gray-200',
              accent: 'from-emerald-400 to-teal-400',
              shadow: 'shadow-emerald-200/50 dark:shadow-emerald-900/20'
            },
            { // Month - Royal violet
              bg: activeTab === tab.key 
                ? 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-900/20 dark:via-purple-900/15 dark:to-indigo-900/10' 
                : 'bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-900/10 dark:to-purple-900/5',
              border: activeTab === tab.key 
                ? 'border-violet-300 dark:border-violet-600' 
                : 'border-violet-200/50 dark:border-violet-800/30',
              text: activeTab === tab.key 
                ? 'text-violet-800 dark:text-violet-200' 
                : 'text-gray-800 dark:text-gray-200',
              accent: 'from-violet-400 to-purple-400',
              shadow: 'shadow-violet-200/50 dark:shadow-violet-900/20'
            },
            { // Custom - Fresh sky
              bg: activeTab === tab.key 
                ? 'bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 dark:from-sky-900/20 dark:via-cyan-900/15 dark:to-blue-900/10' 
                : 'bg-gradient-to-br from-sky-50/40 to-cyan-50/30 dark:from-sky-900/10 dark:to-cyan-900/5',
              border: activeTab === tab.key 
                ? 'border-sky-300 dark:border-sky-600' 
                : 'border-sky-200/50 dark:border-sky-800/30',
              text: activeTab === tab.key 
                ? 'text-sky-800 dark:text-sky-200' 
                : 'text-gray-800 dark:text-gray-200',
              accent: 'from-sky-400 to-cyan-400',
              shadow: 'shadow-sky-200/50 dark:shadow-sky-900/20'
            }
          ];
          const color = colors[index];
          
          return (
            <div
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`group relative rounded-2xl border-2 cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-xl ${
                color.bg
              } ${color.border} ${
                activeTab === tab.key 
                  ? `${color.shadow} shadow-lg transform scale-[1.02]` 
                  : 'shadow-sm hover:shadow-lg'
              }`}
            >
              {/* Decorative corner pattern */}
              <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl">
                <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-bl ${color.accent} opacity-10 transform rotate-45 translate-x-8 -translate-y-8`}></div>
              </div>
              
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm transition-transform duration-300 ${
                      activeTab === tab.key ? 'scale-110' : 'group-hover:scale-105'
                    }`}>
                      <span className="text-2xl filter drop-shadow-sm">
                        {tab.icon}
                      </span>
                    </div>
                    
                    <h3 className={`text-lg font-bold tracking-tight transition-colors duration-300 ${color.text}`}>
                      {tab.label}
                    </h3>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                    activeTab === tab.key 
                      ? 'text-gray-600 dark:text-gray-300' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {tab.key === 'today' && 'Real-time daily insights'}
                    {tab.key === 'week' && 'Weekly performance trends'}
                    {tab.key === 'month' && 'Monthly growth analysis'}
                    {tab.key === 'custom' && 'Flexible date ranges'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistics Content Based on Active Tab */}
      <div className="min-h-[400px]">
        {activeTab === 'today' && (
          <div className="space-y-6">
            <TodayStatistics onRefresh={handleRefresh} />
            
            {/* Today's Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CallDirectionPieChart />
              <CallStatusPieChart />
              <IncomingCallAnalysisPieChart />
              <OutgoingCallAnalysisPieChart />
            </div>
          </div>
        )}
        
        {activeTab === 'week' && (
          <div className="space-y-6">
            <WeeklyStatistics onRefresh={handleRefresh} />
            
            {/* Weekly insights could include trend charts or additional analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🔄 Weekly Trends
                </h3>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Weekly trend analysis coming soon...
                  </p>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  👥 Agent Performance
                </h3>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Agent statistics coming soon...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'month' && (
          <div className="space-y-6">
            <MonthlyStatistics onRefresh={handleRefresh} />
            
            {/* Monthly insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📈 Monthly Growth
                </h3>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Monthly growth analysis coming soon...
                  </p>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🎯 KPI Summary
                </h3>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Key performance indicators coming soon...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'custom' && (
          <div className="space-y-6">
            <CustomRangeStatistics 
              dateRange={customDateRange}
              onRefresh={handleRefresh}
              onEditRange={openCustomRangeModal}
            />
          </div>
        )}
      </div>

      
      {/* Custom Range Modal */}
      <CustomRangeModal
        isOpen={isCustomRangeModalOpen}
        onClose={closeCustomRangeModal}
        onDateRangeSelected={handleDateRangeSelected}
      />
    </div>
  );
};

export default Dashboard;