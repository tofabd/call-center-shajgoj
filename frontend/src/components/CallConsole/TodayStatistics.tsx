import React from 'react';

// Call Stats Interface
interface CallStats {
  total_calls: number;
  calls_by_status?: {
    answered?: number;
    'no answer'?: number;
    busy?: number;
    failed?: number;
  };
}

interface TodayStatisticsProps {
  loading: boolean;
  error: string | null;
  callStats: CallStats | null;
}

const TodayStatistics: React.FC<TodayStatisticsProps> = ({
  loading,
  error,
  callStats
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Today's Statistics</h3>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="space-y-4">
            <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : callStats ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{callStats.total_calls}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Answered</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">{callStats.calls_by_status?.answered || 0}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missed</span>
              <span className="text-xl font-bold text-red-600 dark:text-red-400">{callStats.calls_by_status?.['no answer'] || 0}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-sm">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Busy</span>
              <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{callStats.calls_by_status?.busy || 0}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</span>
              <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{callStats.calls_by_status?.failed || 0}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TodayStatistics;