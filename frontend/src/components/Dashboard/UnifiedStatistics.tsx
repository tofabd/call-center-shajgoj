import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Users } from 'lucide-react';
import IncomingCallAnalysisPieChart from './IncomingCallAnalysisPieChart';
import OutgoingCallAnalysisPieChart from './OutgoingCallAnalysisPieChart';
import type { PeriodStats, TimeRange } from '@services/callLogService';

interface UnifiedStatisticsProps {
  period: TimeRange;
  stats: PeriodStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const UnifiedStatistics: React.FC<UnifiedStatisticsProps> = ({
  period,
  stats,
  loading,
  error,
  onRefresh
}) => {
  const [countdown, setCountdown] = useState(60);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Auto-refresh countdown effect
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger silent refresh when countdown reaches 0
          if (onRefresh) {
            onRefresh();
          }
          return 60; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, onRefresh]);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    if (onRefresh) {
      onRefresh();
    }
    // Reset manual refreshing state and countdown after update completes
    setTimeout(() => {
      setIsManualRefreshing(false);
      setCountdown(60); // Reset countdown after update is complete
    }, 1000);
  }, [onRefresh]);

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshEnabled(!isAutoRefreshEnabled);
    if (!isAutoRefreshEnabled) {
      setCountdown(60);
    }
  }, [isAutoRefreshEnabled]);

  // Get period configuration
  const getPeriodConfig = () => {
    const configs = {
      today: {
        color: 'blue',
        icon: '📅',
        gradient: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      },
      weekly: {
        color: 'green',
        icon: '📊',
        gradient: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
        borderColor: 'border-green-200 dark:border-green-800'
      },
      monthly: {
        color: 'purple',
        icon: '📈',
        gradient: 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800'
      },
      custom: {
        color: 'orange',
        icon: '📊',
        gradient: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800'
      }
    };
    return configs[period];
  };

  const config = getPeriodConfig();

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Format time duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Comparison indicator component
  const ComparisonIndicator: React.FC<{ value: number; isPercentage?: boolean }> = ({ value, isPercentage = false }) => {
    if (value === 0) return null;
    
    const isPositive = value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    
    return (
      <div className={`flex items-center space-x-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">
          {isPositive ? '+' : ''}{isPercentage ? `${value}%` : formatNumber(value)}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className={`px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r ${config.gradient}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{config.icon}</div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats?.date_range.period_name || 'Statistics'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Call center performance metrics
              </p>
            </div>
          </div>
          
          {/* Right side controls */}
          <div className="flex items-center space-x-3">
            {/* Auto-refresh toggle */}
            <button
              onClick={toggleAutoRefresh}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                isAutoRefreshEnabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={isAutoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              {isAutoRefreshEnabled ? 'Auto ON' : 'Auto OFF'}
            </button>
            
            {/* Countdown display or Updating indicator */}
            {isAutoRefreshEnabled && (
              <div className={`px-2 py-1 rounded-lg w-28 text-center ${
                isManualRefreshing || loading
                  ? 'bg-orange-100 dark:bg-orange-900/30' // Updating mode
                  : countdown > 5
                    ? 'bg-blue-100 dark:bg-blue-900/30' // Countdown mode
                    : 'bg-orange-100 dark:bg-orange-900/30' // Auto-update mode
              }`}>
                <span className={`text-xs font-medium block ${
                  isManualRefreshing || loading
                    ? 'text-orange-700 dark:text-orange-400' // Updating mode
                    : countdown > 5
                      ? 'text-blue-700 dark:text-blue-400' // Countdown mode
                      : 'text-orange-700 dark:text-orange-400' // Auto-update mode
                }`}>
                  {isManualRefreshing || loading
                    ? 'Updating...' // Manual refresh in progress
                    : countdown > 5
                      ? `Update in ${countdown}s` // Normal countdown
                      : 'Updating...' // Auto-update in progress
                  }
                </span>
              </div>
            )}
            
            {/* Refresh button */}
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                countdown <= 5 && isAutoRefreshEnabled
                  ? 'bg-orange-100 dark:bg-orange-900/30' // Auto-update mode
                  : isManualRefreshing || loading
                    ? 'bg-blue-100 dark:bg-blue-900/30' // Manual refresh mode - blue background
                    : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
              }`}
              title={countdown <= 5 && isAutoRefreshEnabled ? 'Auto-updating...' : 'Click to refresh now'}
              disabled={countdown <= 5 && isAutoRefreshEnabled}
            >
              <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                countdown <= 5 && isAutoRefreshEnabled
                  ? 'text-orange-600 dark:text-orange-400 animate-spin'
                  : isManualRefreshing || loading
                    ? 'text-blue-600 dark:text-blue-400 animate-spin'
                    : 'text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto narrow-scrollbar">
        {loading ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 dark:border-blue-400/20 border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading statistics...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          </div>
        ) : stats ? (
          <div className="p-6">
            <div className="space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Calls */}
                <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Calls</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {formatNumber(stats.totals.total_calls)}
                      </p>
                      {stats.comparison && (
                        <ComparisonIndicator value={stats.comparison.total_calls_change} />
                      )}
                    </div>
                    <Phone className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                  </div>
                </div>

                {/* Incoming Calls */}
                <div className="bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Incoming</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {formatNumber(stats.totals.incoming_calls)}
                      </p>
                      {stats.comparison && (
                        <ComparisonIndicator value={stats.comparison.incoming_calls_change} />
                      )}
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {stats.totals.total_calls > 0 ? 
                          `${Math.round((stats.totals.incoming_calls / stats.totals.total_calls) * 100)}% of total` : 
                          '0% of total'
                        }
                      </p>
                    </div>
                    <PhoneIncoming className="h-8 w-8 text-green-500 dark:text-green-400" />
                  </div>
                </div>

                {/* Outgoing Calls */}
                <div className="bg-linear-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Outgoing</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {formatNumber(stats.totals.outgoing_calls)}
                      </p>
                      {stats.comparison && (
                        <ComparisonIndicator value={stats.comparison.outgoing_calls_change} />
                      )}
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        {stats.totals.total_calls > 0 ? 
                          `${Math.round((stats.totals.outgoing_calls / stats.totals.total_calls) * 100)}% of total` : 
                          '0% of total'
                        }
                      </p>
                    </div>
                    <PhoneOutgoing className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                  </div>
                </div>

                {/* Answer Rate */}
                <div className="bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Answer Rate</p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {stats.performance_metrics.answer_rate}%
                      </p>
                      {stats.comparison && (
                        <ComparisonIndicator value={stats.comparison.answer_rate_change} isPercentage />
                      )}
                    </div>
                    <Users className="h-8 w-8 text-orange-500 dark:text-orange-400" />
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Ring Time</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatDuration(stats.performance_metrics.avg_ring_time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Talk Time</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatDuration(stats.performance_metrics.avg_talk_time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Peak {period === 'today' ? 'Hour' : 'Day'}</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {stats.performance_metrics.peak_hour}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <PhoneMissed className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Missed Calls</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatNumber(stats.totals.missed_calls)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Incoming vs Outgoing Call Analysis - Visual Charts */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Incoming vs Outgoing Call Analysis</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Incoming Call Analysis Pie Chart */}
                  <IncomingCallAnalysisPieChart
                    answeredCount={stats.incoming_metrics.answered}
                    missedCount={stats.incoming_metrics.missed}
                    busyCount={stats.incoming_metrics.busy || 0}
                    failedCount={stats.incoming_metrics.failed || 0}
                    noAnswerCount={(stats.incoming_metrics as any).no_answer || 0}
                    canceledCount={(stats.incoming_metrics as any).canceled || 0}
                    rejectedCount={(stats.incoming_metrics as any).rejected || 0}
                    title="Incoming Call Status"
                    height={400}
                  />
                  
                  {/* Outgoing Call Analysis Pie Chart */}
                  <OutgoingCallAnalysisPieChart
                    answeredCount={stats.outgoing_metrics.answered}
                    missedCount={stats.outgoing_metrics.missed}
                    busyCount={stats.outgoing_metrics.busy || 0}
                    failedCount={stats.outgoing_metrics.failed || 0}
                    noAnswerCount={(stats.outgoing_metrics as any).no_answer || 0}
                    canceledCount={(stats.outgoing_metrics as any).canceled || 0}
                    rejectedCount={(stats.outgoing_metrics as any).rejected || 0}
                    title="Outgoing Call Status"
                    height={400}
                  />
                </div>
              </div>

              {/* Call Status Breakdown */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Breakdown</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Answered</span>
                      <span className="text-xl font-bold text-green-900 dark:text-green-100">
                        {formatNumber(stats.totals.answered_calls)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-linear-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Missed</span>
                      <span className="text-xl font-bold text-red-900 dark:text-red-100">
                        {formatNumber(stats.totals.missed_calls)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Busy</span>
                      <span className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                        {formatNumber(stats.totals.busy_calls)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-linear-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</span>
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(stats.totals.failed_calls)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {period === 'custom' 
                  ? 'Please select a custom date range to view statistics'
                  : 'No statistics available'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedStatistics;