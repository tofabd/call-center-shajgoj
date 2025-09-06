import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, RefreshCw, CalendarRange } from 'lucide-react';
import { callService } from '@/services/callService';
import type { CallStatistics } from '@/services/callService';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface CustomRangeStatisticsProps {
  dateRange: DateRange | null;
  onRefresh?: () => void;
  onEditRange: () => void;
}

const CustomRangeStatistics: React.FC<CustomRangeStatisticsProps> = ({ 
  dateRange, 
  onRefresh,
  onEditRange 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CallStatistics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await callService.getDateRangeStats(dateRange.startDate, dateRange.endDate);
      setStats(data);
    } catch (err) {
      setError('Failed to load date range statistics');
      console.error('Date range stats error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [fetchData, onRefresh]);

  // Auto-fetch when date range changes
  useEffect(() => {
    if (dateRange?.startDate && dateRange?.endDate) {
      fetchData();
    }
  }, [fetchData]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getDaysInRange = () => {
    if (!dateRange?.startDate || !dateRange?.endDate) return 0;
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // No date range selected
  if (!dateRange) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-sky-600 rounded-lg">
                <CalendarRange className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Date Range</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select a date range to view statistics
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="text-center py-16">
          <Calendar className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Date Range Selected</h4>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Click the Custom Range card above to select a date range and view analytics.
          </p>
          <button
            onClick={onEditRange}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Select Date Range
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Date Range</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {dateRange.label}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onEditRange}
              className="px-3 py-2 text-sm bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 rounded-lg border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400"
            >
              Change Range
            </button>
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isRefreshing
                  ? 'bg-sky-100 dark:bg-sky-900/30'
                  : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
              }`}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                isRefreshing
                  ? 'text-sky-600 dark:text-sky-400 animate-spin'
                  : 'text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-sky-500/30 dark:border-sky-400/20 border-t-sky-500 dark:border-t-sky-400 animate-spin"></div>
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
            {/* Key Metrics with Total Calls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { 
                  label: 'Total Calls', 
                  value: stats.total_calls, 
                  color: 'sky',
                  icon: '📞'
                },
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
                  metric.color === 'sky' ? 'from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 border-sky-200 dark:border-sky-800' :
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
                    metric.color === 'sky' ? 'text-sky-600 dark:text-sky-400' :
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
      </div>
    </div>
  );
};

export default CustomRangeStatistics;