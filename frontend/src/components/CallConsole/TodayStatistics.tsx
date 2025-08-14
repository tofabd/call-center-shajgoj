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
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Today's Statistics</h3>
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
          <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">{callStats.total_calls}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Answered</span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{callStats.calls_by_status?.answered || 0}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missed</span>
            <span className="text-xl font-bold text-red-600 dark:text-red-400">{callStats.calls_by_status?.['no answer'] || 0}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TodayStatistics;