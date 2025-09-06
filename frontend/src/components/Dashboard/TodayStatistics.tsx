import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { callService } from '@/services/callService';
import type { CallStatistics } from '@/services/callService';

interface TodayStatisticsProps {
  onRefresh?: () => void;
}

const TodayStatistics: React.FC<TodayStatisticsProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStats, setCallStats] = useState<CallStatistics | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('dashboard-auto-refresh');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await callService.getTodayStats();
      setCallStats(data);
    } catch (err) {
      setError('Failed to load today\'s statistics');
      console.error('Today stats error:', err);
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
          // Trigger silent refresh when countdown reaches 0
          fetchData();
          return 60; // Reset countdown to 60 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, fetchData]);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await fetchData();
    if (onRefresh) onRefresh();
    // Reset manual refreshing state and countdown after update completes
    setTimeout(() => {
      setIsManualRefreshing(false);
      setCountdown(60); // Reset countdown to 60 seconds after update is complete
    }, 1000);
  }, [fetchData, onRefresh]);

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    const newValue = !isAutoRefreshEnabled;
    setIsAutoRefreshEnabled(newValue);
    localStorage.setItem('dashboard-auto-refresh', JSON.stringify(newValue));
    if (newValue) {
      setCountdown(60);
    }
  }, [isAutoRefreshEnabled]);
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-600 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Today's Statistics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Call statistics for today
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
              
              {/* Single refresh icon with countdown and update states */}
              <div className="flex items-center space-x-2">
                {/* Countdown display or Updating indicator - Fixed width */}
                {isAutoRefreshEnabled && (
                  <div className={`px-2 py-1 rounded-lg w-24 text-center ${
                    isManualRefreshing || loading
                      ? 'bg-orange-100 dark:bg-orange-900/30' // Updating mode
                      : countdown > 3
                        ? 'bg-blue-100 dark:bg-blue-900/30' // Countdown mode
                        : 'bg-orange-100 dark:bg-orange-900/30' // Auto-update mode
                  }`}>
                    <span className={`text-xs font-medium block ${
                      isManualRefreshing || loading
                        ? 'text-orange-700 dark:text-orange-400' // Updating mode
                        : countdown > 3
                          ? 'text-blue-700 dark:text-blue-400' // Countdown mode
                          : 'text-orange-700 dark:text-orange-400' // Auto-update mode
                    }`}>
                      {isManualRefreshing || loading
                        ? 'Updating...' // Manual refresh in progress
                        : countdown > 3
                          ? `Update in ${countdown}s` // Normal countdown
                          : 'Updating...' // Auto-update in progress
                      }
                    </span>
                  </div>
                )}
                
                {/* Single refresh icon - changes behavior based on state */}
                <button
                  onClick={handleManualRefresh}
                  className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                    countdown <= 3 && isAutoRefreshEnabled
                      ? 'bg-orange-100 dark:bg-orange-900/30' // Auto-update mode
                      : isManualRefreshing || loading
                        ? 'bg-blue-100 dark:bg-blue-900/30' // Manual refresh mode - blue background
                        : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md' // Normal mode with hover effect
                  }`}
                  title={countdown <= 3 && isAutoRefreshEnabled ? 'Auto-updating...' : 'Click to refresh now'}
                  disabled={countdown <= 3 && isAutoRefreshEnabled} // Disable during auto-update
                >
                  <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                    countdown <= 3 && isAutoRefreshEnabled
                      ? 'text-orange-600 dark:text-orange-400 animate-spin' // Auto-update mode
                      : isManualRefreshing || loading
                        ? 'text-blue-600 dark:text-blue-400 animate-spin' // Manual refresh loading - blue color
                        : 'text-gray-600 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:scale-110' // Normal mode with hover scale
                  }`} />
                </button>
                

              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto narrow-scrollbar">
          {loading ? (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full border-4 border-orange-500/30 dark:border-orange-400/20 border-t-orange-500 dark:border-t-orange-400 animate-spin"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading statistics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            </div>
          ) : callStats ? (
            <div className="p-6">
              <div className="w-full space-y-6">
                {/* Overall Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex justify-between items-center p-4 bg-linear-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{callStats.total_calls}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Incoming</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{callStats.incoming_calls}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-linear-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl border border-teal-200 dark:border-teal-800 shadow-sm">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Outgoing</span>
                    <span className="text-xl font-bold text-teal-600 dark:text-teal-400">{callStats.outgoing_calls}</span>
                  </div>
                </div>

                {/* Call Status Breakdown */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">{callStats.calls_by_status?.completed || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">{callStats.calls_by_status?.in_progress || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missed</span>
                      <span className="text-xl font-bold text-red-600 dark:text-red-400">{callStats.calls_by_status?.['no_answer'] || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Busy</span>
                      <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{callStats.calls_by_status?.busy || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</span>
                      <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{callStats.calls_by_status?.failed || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200 dark:border-orange-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Canceled</span>
                      <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{callStats.calls_by_status?.canceled || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl border border-pink-200 dark:border-pink-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</span>
                      <span className="text-xl font-bold text-pink-600 dark:text-pink-400">{callStats.calls_by_status?.rejected || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-linear-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ringing</span>
                      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{callStats.calls_by_status?.ringing || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Direction-based Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Incoming Calls Breakdown */}
                  <div className="bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4 shadow-sm">
                    <h5 className="text-md font-semibold text-blue-900 dark:text-blue-300 mb-3">Incoming Calls</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Completed:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">{callStats.incoming_by_status?.completed || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Missed:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">{callStats.incoming_by_status?.['no_answer'] || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Busy:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">{callStats.incoming_by_status?.busy || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Failed:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">{callStats.incoming_by_status?.failed || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Outgoing Calls Breakdown */}
                  <div className="bg-linear-to-br from-teal-50 to-cyan-50 dark:from-teal-900/10 dark:to-cyan-900/10 rounded-xl border border-teal-200 dark:border-teal-800 p-4 shadow-sm">
                    <h5 className="text-md font-semibold text-teal-900 dark:text-teal-300 mb-3">Outgoing Calls</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-teal-700 dark:text-teal-300">Completed:</span>
                        <span className="font-medium text-teal-900 dark:text-teal-100">{callStats.outgoing_by_status?.completed || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-teal-700 dark:text-teal-300">No Answer:</span>
                        <span className="font-medium text-teal-900 dark:text-teal-100">{callStats.outgoing_by_status?.['no_answer'] || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-teal-700 dark:text-teal-300">Busy:</span>
                        <span className="font-medium text-teal-900 dark:text-teal-100">{callStats.outgoing_by_status?.busy || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-teal-700 dark:text-teal-300">Failed:</span>
                        <span className="font-medium text-teal-900 dark:text-teal-100">{callStats.outgoing_by_status?.failed || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">⏱️</span>
                      <h5 className="text-md font-semibold text-amber-900 dark:text-amber-300">Average Handle Time</h5>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {callStats.metrics?.average_handle_time ? Math.round(callStats.metrics.average_handle_time / 60) : 0} min
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Per completed call
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">✅</span>
                      <h5 className="text-md font-semibold text-emerald-900 dark:text-emerald-300">Answer Rate</h5>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {callStats.metrics?.answer_rate || 0}%
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      Success rate
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border border-rose-200 dark:border-rose-800 p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">🔴</span>
                      <h5 className="text-md font-semibold text-rose-900 dark:text-rose-300">Active Calls</h5>
                    </div>
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {callStats.metrics?.active_calls || 0}
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      Currently ongoing
                    </p>
                  </div>
                </div>


              </div>
            </div>
          ) : (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No statistics available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodayStatistics;