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
      {/* Today's Statistics Section */}
      <TodayStatistics
        loading={loading}
        error={error}
        callStats={callStats}
      />
    </div>
  );
};

export default Dashboard; 