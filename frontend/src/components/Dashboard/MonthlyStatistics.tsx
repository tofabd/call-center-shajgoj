import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { callService } from '@/services/callService';
import type { CallStatistics } from '@/services/callService';

interface MonthlyStatisticsProps {
  onRefresh?: () => void;
}

const MonthlyStatistics: React.FC<MonthlyStatisticsProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<CallStatistics | null>(null);
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
      
      const [monthData, comparisonData] = await Promise.all([
        callService.getMonthStats(),
        callService.getComparisonStats('month')
      ]);

      setMonthlyStats(monthData);
      setComparison(comparisonData);
    } catch (err) {
      setError('Failed to load monthly statistics');
      console.error('Monthly stats error:', err);
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 dark:border-purple-400/20 border-t-purple-500 dark:border-t-purple-400 animate-spin"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading monthly statistics...</p>
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
              className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
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
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Monthly Statistics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {monthlyStats?.period?.label || 'This month\'s performance'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRefreshing
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
            }`}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
              isRefreshing
                ? 'text-purple-600 dark:text-purple-400 animate-spin'
                : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
            }`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              label: 'Total Calls', 
              current: monthlyStats?.total_calls || 0, 
              change: comparison?.changes?.total_calls || 0,
              color: 'purple',
              icon: '📞'
            },
            { 
              label: 'Incoming', 
              current: monthlyStats?.incoming_calls || 0, 
              change: comparison?.changes?.incoming_calls || 0,
              color: 'blue',
              icon: '📥'
            },
            { 
              label: 'Outgoing', 
              current: monthlyStats?.outgoing_calls || 0, 
              change: comparison?.changes?.outgoing_calls || 0,
              color: 'teal',
              icon: '📤'
            },
            { 
              label: 'Answer Rate', 
              current: monthlyStats?.metrics?.answer_rate || 0, 
              change: comparison?.changes?.answer_rate || 0,
              color: 'green',
              isPercentage: true,
              icon: '✅'
            }
          ].map((metric, index) => (
            <div key={index} className={`relative overflow-hidden rounded-xl border shadow-sm bg-gradient-to-br ${
              metric.color === 'purple' ? 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800' :
              metric.color === 'blue' ? 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' :
              metric.color === 'teal' ? 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-200 dark:border-teal-800' :
              'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
            }`}>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{metric.icon}</span>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</p>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metric.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                      metric.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      metric.color === 'teal' ? 'text-teal-600 dark:text-teal-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metric.current.toLocaleString()}{metric.isPercentage ? '%' : ''}
                    </p>
                  </div>
                  <div className="ml-2">
                    {renderChangeIndicator(metric.change)}
                  </div>
                </div>
              </div>
              
              {/* Decorative background pattern */}
              <div className={`absolute top-0 right-0 w-20 h-20 opacity-10 ${
                metric.color === 'purple' ? 'text-purple-600' :
                metric.color === 'blue' ? 'text-blue-600' :
                metric.color === 'teal' ? 'text-teal-600' :
                'text-green-600'
              }`}>
                <div className="text-6xl font-bold transform rotate-12 translate-x-4 -translate-y-2">
                  {metric.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Advanced Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">⏱️</span>
              <h5 className="text-md font-semibold text-amber-900 dark:text-amber-300">Average Handle Time</h5>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatDuration(monthlyStats?.metrics?.average_handle_time || 0)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Per completed call
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">✅</span>
              <h5 className="text-md font-semibold text-emerald-900 dark:text-emerald-300">Completed Calls</h5>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {(monthlyStats?.metrics?.completed_calls || 0).toLocaleString()}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Successfully handled
            </p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border border-rose-200 dark:border-rose-800 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">🔴</span>
              <h5 className="text-md font-semibold text-rose-900 dark:text-rose-300">Active Calls</h5>
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {(monthlyStats?.metrics?.active_calls || 0).toLocaleString()}
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              Currently ongoing
            </p>
          </div>
        </div>

        {/* Call Status Distribution */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <span>📊</span>
            <span>Call Status Distribution</span>
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'completed', label: 'Completed', color: 'green', icon: '✅' },
              { key: 'in_progress', label: 'In Progress', color: 'blue', icon: '🔵' },
              { key: 'no_answer', label: 'No Answer', color: 'red', icon: '📵' },
              { key: 'busy', label: 'Busy', color: 'yellow', icon: '⏳' },
              { key: 'failed', label: 'Failed', color: 'purple', icon: '❌' },
              { key: 'canceled', label: 'Canceled', color: 'orange', icon: '⚠️' },
              { key: 'rejected', label: 'Rejected', color: 'pink', icon: '🚫' },
              { key: 'ringing', label: 'Ringing', color: 'indigo', icon: '📞' }
            ].map((status) => (
              <div key={status.key} className={`p-3 rounded-lg border shadow-sm ${
                status.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                status.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                status.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                status.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                status.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' :
                status.color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' :
                status.color === 'pink' ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' :
                'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
              }`}>
                <div className="flex flex-col items-center text-center">
                  <span className="text-2xl mb-1">{status.icon}</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{status.label}</span>
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
                    {(monthlyStats?.calls_by_status?.[status.key] || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Month-over-Month Comparison */}
        {comparison && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800 p-5">
            <h5 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center space-x-2">
              <span>📈</span>
              <span>Month-over-Month Comparison</span>
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Calls', change: comparison.changes?.total_calls || 0, previous: comparison.previous?.total_calls || 0 },
                { label: 'Answer Rate', change: comparison.changes?.answer_rate || 0, previous: comparison.previous?.metrics?.answer_rate || 0, suffix: '%' },
                { label: 'Completed Calls', change: comparison.changes?.completed_calls || 0, previous: comparison.previous?.metrics?.completed_calls || 0 }
              ].map((item, index) => (
                <div key={index} className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{item.label}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Last month: {item.previous.toLocaleString()}{item.suffix || ''}
                      </p>
                    </div>
                    <div className="text-right">
                      {renderChangeIndicator(item.change)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyStatistics;