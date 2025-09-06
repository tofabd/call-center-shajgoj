import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { callService } from '@/services/callService';
import type { CallStatistics } from '@/services/callService';

interface WeeklyStatisticsProps {
  onRefresh?: () => void;
}

const WeeklyStatistics: React.FC<WeeklyStatisticsProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<CallStatistics | null>(null);
  const [lastWeekStats, setLastWeekStats] = useState<CallStatistics | null>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [countdown, setCountdown] = useState(60);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('dashboard-auto-refresh');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [weekData, lastWeekData, comparisonData] = await Promise.all([
        callService.getWeekStats(),
        callService.getLastWeekStats(),
        callService.getComparisonStats('week')
      ]);

      setWeeklyStats(weekData);
      setLastWeekStats(lastWeekData);
      setComparison(comparisonData);
    } catch (err) {
      setError('Failed to load weekly statistics');
      console.error('Weekly stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh countdown effect
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, fetchData]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    setIsRefreshing(true);
    await fetchData();
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsManualRefreshing(false);
      setIsRefreshing(false);
      setCountdown(60);
    }, 1000);
  }, [fetchData, onRefresh]);

  const toggleAutoRefresh = useCallback(() => {
    const newValue = !isAutoRefreshEnabled;
    setIsAutoRefreshEnabled(newValue);
    localStorage.setItem('dashboard-auto-refresh', JSON.stringify(newValue));
    if (newValue) {
      setCountdown(60);
    }
  }, [isAutoRefreshEnabled]);

  const renderChangeIndicator = (change: number) => {
    if (change > 0) {
      return (
        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs font-medium">+{change.toFixed(1)}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
          <TrendingDown className="h-3 w-3" />
          <span className="text-xs font-medium">{change.toFixed(1)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
          <Minus className="h-3 w-3" />
          <span className="text-xs font-medium">0%</span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 dark:border-blue-400/20 border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading weekly statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            <button 
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Statistics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {weeklyStats?.period?.label || 'This week\'s performance'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRefreshing
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
            }`}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
              isRefreshing
                ? 'text-blue-600 dark:text-blue-400 animate-spin'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Key Metrics with Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              label: 'Total Calls', 
              current: weeklyStats?.total_calls || 0, 
              change: comparison?.changes?.total_calls || 0,
              color: 'gray'
            },
            { 
              label: 'Incoming', 
              current: weeklyStats?.incoming_calls || 0, 
              change: comparison?.changes?.incoming_calls || 0,
              color: 'blue'
            },
            { 
              label: 'Outgoing', 
              current: weeklyStats?.outgoing_calls || 0, 
              change: comparison?.changes?.outgoing_calls || 0,
              color: 'teal'
            },
            { 
              label: 'Answer Rate', 
              current: weeklyStats?.metrics?.answer_rate || 0, 
              change: comparison?.changes?.answer_rate || 0,
              color: 'green',
              isPercentage: true
            }
          ].map((metric, index) => (
            <div key={index} className={`p-4 rounded-xl border shadow-sm bg-gradient-to-br ${
              metric.color === 'gray' ? 'from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700 border-gray-200 dark:border-gray-600' :
              metric.color === 'blue' ? 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' :
              metric.color === 'teal' ? 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-200 dark:border-teal-800' :
              'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</p>
                  <p className={`text-2xl font-bold ${
                    metric.color === 'gray' ? 'text-gray-900 dark:text-white' :
                    metric.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    metric.color === 'teal' ? 'text-teal-600 dark:text-teal-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {metric.current}{metric.isPercentage ? '%' : ''}
                  </p>
                </div>
                <div className="ml-2">
                  {renderChangeIndicator(metric.change)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Status Breakdown */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Breakdown</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'completed', label: 'Completed', color: 'green' },
              { key: 'in_progress', label: 'In Progress', color: 'blue' },
              { key: 'no_answer', label: 'No Answer', color: 'red' },
              { key: 'busy', label: 'Busy', color: 'yellow' },
              { key: 'failed', label: 'Failed', color: 'purple' },
              { key: 'canceled', label: 'Canceled', color: 'orange' },
              { key: 'rejected', label: 'Rejected', color: 'pink' },
              { key: 'ringing', label: 'Ringing', color: 'indigo' }
            ].map((status) => (
              <div key={status.key} className={`flex justify-between items-center p-3 rounded-lg border shadow-sm ${
                status.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                status.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                status.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                status.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                status.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' :
                status.color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' :
                status.color === 'pink' ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' :
                'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
              }`}>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{status.label}</span>
                <span className={`text-lg font-bold ${
                  status.color === 'green' ? 'text-green-600 dark:text-green-400' :
                  status.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                  status.color === 'red' ? 'text-red-600 dark:text-red-400' :
                  status.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                  status.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                  status.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                  status.color === 'pink' ? 'text-pink-600 dark:text-pink-400' :
                  'text-indigo-600 dark:text-indigo-400'
                }`}>
                  {weeklyStats?.calls_by_status?.[status.key] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
            <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Performance Metrics</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Average Handle Time</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {weeklyStats?.metrics?.average_handle_time ? Math.round(weeklyStats.metrics.average_handle_time / 60) : 0} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Completed Calls</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {weeklyStats?.metrics?.completed_calls || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Calls</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {weeklyStats?.metrics?.active_calls || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
            <h5 className="text-md font-semibold text-blue-900 dark:text-blue-300 mb-3">vs Last Week</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 dark:text-blue-300">Total Calls</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {lastWeekStats?.total_calls || 0}
                  </span>
                  {renderChangeIndicator(comparison?.changes?.total_calls || 0)}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 dark:text-blue-300">Answer Rate</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {lastWeekStats?.metrics?.answer_rate || 0}%
                  </span>
                  {renderChangeIndicator(comparison?.changes?.answer_rate || 0)}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 dark:text-blue-300">Completed</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {lastWeekStats?.metrics?.completed_calls || 0}
                  </span>
                  {renderChangeIndicator(comparison?.changes?.completed_calls || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyStatistics;