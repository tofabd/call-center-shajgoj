import React, { useState, useEffect } from 'react';
import TodayStatistics from '@/components/Dashboard/TodayStatistics';
import { callLogService } from '@services/callLogService';
import type { CallStats } from '@services/callLogService';

const Dashboard: React.FC = () => {
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallStats = async () => {
      try {
        setLoading(true);
        const stats = await callLogService.getTodayStats();
        setCallStats(stats);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch call stats:', err);
        setError('Failed to load call statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchCallStats();
  }, []);

  return (
    <div className="w-full p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome back! Here's what's happening with your CRM today.
        </p>
      </div>

      {/* Call Statistics Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Call Center Statistics</h3>
        </div>
        <div className="h-96">
          <TodayStatistics
            loading={loading}
            error={error}
            callStats={callStats}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 