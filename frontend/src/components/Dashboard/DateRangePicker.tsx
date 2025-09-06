import React, { useState, useCallback } from 'react';
import { Calendar, RefreshCw, CalendarRange, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { callService } from '@/services/callService';
import type { CallStatistics } from '@/services/callService';

interface DateRangePickerProps {
  onRefresh?: () => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CallStatistics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Quick date range options
  const quickRanges = [
    {
      label: 'Last 7 Days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'Last 30 Days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'Last 3 Months',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'This Year',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date();
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    }
  ];

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await callService.getDateRangeStats(startDate, endDate);
      setStats(data);
    } catch (err) {
      setError('Failed to load date range statistics');
      console.error('Date range stats error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const handleQuickRange = useCallback((range: any) => {
    const { start, end } = range.getValue();
    setStartDate(start);
    setEndDate(end);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [fetchData, onRefresh]);

  // Auto-fetch when dates change
  React.useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [fetchData]);

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

  const getDaysInRange = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Date Range</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats?.period?.label || 'Select date range to view statistics'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRefreshing
                ? 'bg-indigo-100 dark:bg-indigo-900/30'
                : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
            }`}
            disabled={isRefreshing || !startDate || !endDate}
          >
            <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
              isRefreshing
                ? 'text-indigo-600 dark:text-indigo-400 animate-spin'
                : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Date Range Selector */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                min={startDate}
              />
            </div>
          </div>

          {/* Quick Range Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Ranges
            </label>
            <div className="flex flex-wrap gap-2">
              {quickRanges.map((range, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickRange(range)}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 dark:border-indigo-400/20 border-t-indigo-500 dark:border-t-indigo-400 animate-spin"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading statistics...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Statistics Display */}
        {stats && !loading && !error && (
          <div className="space-y-6">
            {/* Period Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300">
                    Period Summary
                  </h4>
                  <p className="text-sm text-indigo-700 dark:text-indigo-400">
                    {getDaysInRange()} days selected • {stats.period?.start_date} to {stats.period?.end_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {stats.total_calls.toLocaleString()}
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">Total Calls</p>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  label: 'Incoming', 
                  value: stats.incoming_calls, 
                  color: 'blue',
                  icon: '📥'
                },
                { 
                  label: 'Outgoing', 
                  value: stats.outgoing_calls, 
                  color: 'teal',
                  icon: '📤'
                },
                { 
                  label: 'Answer Rate', 
                  value: stats.metrics.answer_rate, 
                  color: 'green',
                  suffix: '%',
                  icon: '✅'
                },
                { 
                  label: 'Completed', 
                  value: stats.metrics.completed_calls, 
                  color: 'purple',
                  icon: '✅'
                }
              ].map((metric, index) => (
                <div key={index} className={`p-4 rounded-xl border shadow-sm bg-gradient-to-br ${
                  metric.color === 'blue' ? 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' :
                  metric.color === 'teal' ? 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-200 dark:border-teal-800' :
                  metric.color === 'green' ? 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' :
                  'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{metric.icon}</span>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{metric.label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${
                    metric.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    metric.color === 'teal' ? 'text-teal-600 dark:text-teal-400' :
                    metric.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    'text-purple-600 dark:text-purple-400'
                  }`}>
                    {metric.value.toLocaleString()}{metric.suffix || ''}
                  </p>
                </div>
              ))}
            </div>

            {/* Advanced Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">⏱️</span>
                  <h5 className="text-md font-semibold text-amber-900 dark:text-amber-300">Avg Handle Time</h5>
                </div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatDuration(stats.metrics.average_handle_time)}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Per call
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">📈</span>
                  <h5 className="text-md font-semibold text-emerald-900 dark:text-emerald-300">Daily Average</h5>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(stats.total_calls / getDaysInRange())}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Calls per day
                </p>
              </div>

              <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border border-rose-200 dark:border-rose-800 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">🔴</span>
                  <h5 className="text-md font-semibold text-rose-900 dark:text-rose-300">Active Calls</h5>
                </div>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {stats.metrics.active_calls.toLocaleString()}
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  Currently ongoing
                </p>
              </div>
            </div>

            {/* Status Breakdown */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{status.label}</p>
                      <p className={`text-lg font-bold ${
                        status.color === 'green' ? 'text-green-600 dark:text-green-400' :
                        status.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        status.color === 'red' ? 'text-red-600 dark:text-red-400' :
                        status.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                        status.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                        status.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        status.color === 'pink' ? 'text-pink-600 dark:text-pink-400' :
                        'text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {(stats.calls_by_status?.[status.key] || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!startDate && !endDate && !loading && (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select Date Range</h4>
            <p className="text-gray-500 dark:text-gray-400">
              Choose a start and end date or use quick ranges to view call statistics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;