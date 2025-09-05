import React, { useCallback } from 'react';
import { PhoneIncoming, PhoneOutgoing, Phone, PhoneCall, Clock, Timer, RefreshCw } from 'lucide-react';
import { StatusTooltip } from '../common/StatusTooltip';

// Interface for individual call
interface IndividualCall {
  id: string; // Changed from number to string for Laravel compatibility
  callerNumber: string;
  callerName: string | null;
  startTime: string;
  endTime?: string;
  status: string;
  duration?: number;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
  created_at?: string;
  disposition?: string; // Added for completed calls
}

interface CallHistoryProps {
  callLogs: IndividualCall[];
  selectedCallId: string | null;
  loading: boolean;
  error: string | null;
  onCallSelect: (callId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Animated ringing icon component that alternates between Phone and PhoneCall
const RingingIcon: React.FC = () => {
  const [isPhoneCall, setIsPhoneCall] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsPhoneCall(prev => !prev);
    }, 300); // Switch every 300ms

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center ml-1">
      {isPhoneCall ? (
        <PhoneCall className="h-4 w-4 animate-pulse text-white" />
      ) : (
        <Phone className="h-4 w-4 animate-pulse text-white" />
      )}
    </span>
  );
};

const CallHistory: React.FC<CallHistoryProps> = ({
  callLogs,
  selectedCallId,
  loading,
  error,
  onCallSelect,
  onRefresh,
  isRefreshing: propIsRefreshing
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isPageVisible, setIsPageVisible] = React.useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = React.useState<NodeJS.Timeout | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = React.useState(false);
  const [countdown, setCountdown] = React.useState(30);
  
  // Use prop isRefreshing if provided, otherwise use local state
  const refreshing = propIsRefreshing ?? isRefreshing;
  
  // Countdown timer effect
  React.useEffect(() => {
    if (!refreshing && !isAutoRefreshing) {
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 30; // Reset to 30 seconds
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [refreshing, isAutoRefreshing]);

  // Reset countdown when refresh occurs
  React.useEffect(() => {
    if (refreshing || isAutoRefreshing) {
      setCountdown(30);
    }
  }, [refreshing, isAutoRefreshing]);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      console.log('🔄 Manual refresh triggered');
      setIsRefreshing(true);
      
      // Reset the periodic timer
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        console.log('⏰ Periodic timer reset due to manual refresh');
      }
      
      onRefresh();
      setTimeout(() => {
        setIsRefreshing(false);
        
        // Restart the periodic timer after manual refresh
        const newInterval = setInterval(() => {
          if (isPageVisible && !isRefreshing && onRefresh) {
            console.log('🔄 Auto refresh: Loading call history (30s interval)');
            setIsAutoRefreshing(true);
            onRefresh();
            setTimeout(() => {
              setIsAutoRefreshing(false);
            }, 1000);
          }
        }, 30000);
        setAutoRefreshInterval(newInterval);
        console.log('⏰ Restarted automatic call history refresh timer');
      }, 1000); // Keep spinning for visual feedback
    }
  }, [onRefresh, autoRefreshInterval, isPageVisible, isRefreshing]);

  // Page visibility handling
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        console.log('📱 Page became visible, checking call history connection...');
        // Force refresh if refresh function is available
        if (onRefresh) {
          onRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onRefresh, isPageVisible, isRefreshing]);



  // Show only completed/ended calls (filter out active calls)
  const sortedCalls = callLogs
    .filter(call => {
      // Show calls that are completed (have endTime OR disposition)
      if (call.endTime || call.disposition) {
        return true; // Show all completed calls including answered+ended
      }
      
      // If no endTime and no disposition, filter out active calls
      return ![
        'ringing', 'ring', 'calling', 'incoming', 
        'started', 'start', 'answered', 'in_progress'
      ].includes(call.status?.toLowerCase());
    })
    .sort((a, b) => {
      // Sort by start time (most recent first)
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

  // Force re-render when call data changes to ensure real-time updates
  React.useEffect(() => {
    // This effect ensures the component re-renders when callLogs change
    console.log('📊 CallHistory: Completed calls updated, count:', sortedCalls.length);
  }, [sortedCalls]);

  React.useEffect(() => {
    // Log when selectedCallId changes to track auto-selection
    if (selectedCallId) {
      console.log('🎯 CallHistory: Selected call ID changed to:', selectedCallId);
    }
  }, [selectedCallId]);

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDuration = (totalSeconds: number): string => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'answered':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'in_progress':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'completed':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case 'busy':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'no answer':
      case 'no_answer':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'ringing':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case 'started':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
      case 'canceled':
      case 'cancelled':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
      case 'congestion':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'missed':
      case 'failed':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Call History</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed and ended calls</p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Countdown Timer / Updating Status */}
              <div className="flex items-center px-2 py-1 rounded-lg text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 min-w-[60px] justify-center">
                {!(refreshing || isAutoRefreshing) && <span className="mr-1">⏰</span>}
                {refreshing || isAutoRefreshing ? 'Updating...' : `${countdown}s`}
              </div>
              
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                    refreshing || isAutoRefreshing
                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                      : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
                  }`}
                  title={(refreshing || isAutoRefreshing) ? 'Refreshing...' : 'Click to refresh call history'}
                  disabled={refreshing || isAutoRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                    refreshing || isAutoRefreshing
                      ? 'text-blue-600 dark:text-blue-400 animate-spin'
                      : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110'
                  }`} />
                </button>
              )}

            </div>
          </div>
        </div>

        {/* Card Content - Flexible Height */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center flex-1 p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneIncoming className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Check your connection</p>
              </div>
            </div>
          ) : callLogs.length > 0 ? (
            <div className="flex-1 overflow-y-auto narrow-scrollbar">
              <div className="p-4 space-y-3">
                {sortedCalls.map((call) => (
                  <div key={`${call.id}-${call.startTime}`} className="space-y-2">
                    {/* Individual Call Item */}
                    <div
                      className={`group p-4 border rounded-xl transition-all duration-200 hover:shadow-md min-h-[80px] flex flex-col justify-center cursor-pointer ${
                        selectedCallId === call.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : (() => {
                              const status = call.status.toLowerCase();
                              const direction = call.direction;
                              
                              // Background colors based on status and direction (following design specs)
                              if (['answered', 'in_progress'].includes(status)) {
                                return direction === 'outgoing'
                                  ? 'border-indigo-300 dark:border-indigo-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30'
                                  : 'border-green-300 dark:border-green-700 bg-linear-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 hover:from-green-100 hover:to-teal-100 dark:hover:from-green-900/30 dark:hover:to-teal-900/30';
                              }
                              if (['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(status)) {
                                return direction === 'outgoing'
                                  ? 'border-indigo-300 dark:border-indigo-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 border-l-4 border-l-indigo-500'
                                  : 'border-green-300 dark:border-green-700 bg-linear-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 hover:from-green-100 hover:to-teal-100 dark:hover:from-green-900/30 dark:hover:to-teal-900/30 border-l-4 border-l-green-500';
                              }
                              if (['busy'].includes(status)) {
                                return direction === 'outgoing'
                                  ? 'border-red-300 dark:border-red-700 bg-linear-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 hover:from-red-100 hover:to-rose-100 dark:hover:from-red-900/30 dark:hover:to-rose-900/30'
                                  : 'border-red-300 dark:border-red-700 bg-linear-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 hover:from-red-100 hover:to-pink-100 dark:hover:from-red-900/30 dark:hover:to-pink-900/30';
                              }
                              if (['no answer', 'missed', 'failed'].includes(status)) {
                                return direction === 'outgoing'
                                  ? 'border-orange-300 dark:border-orange-700 bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30'
                                  : 'border-yellow-300 dark:border-yellow-700 bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 hover:from-yellow-100 hover:to-amber-100 dark:hover:from-yellow-900/30 dark:hover:to-amber-900/30';
                              }
                              // Default (completed, etc.)
                              return direction === 'outgoing'
                                ? 'border-gray-200 dark:border-gray-600 bg-linear-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 hover:from-gray-100 hover:to-slate-100 dark:hover:from-gray-700 dark:hover:to-slate-700'
                                : 'border-gray-200 dark:border-gray-600 bg-linear-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 hover:from-slate-100 hover:to-gray-100 dark:hover:from-slate-700 dark:hover:to-gray-700';
                            })()
                      }`}
                      onClick={() => onCallSelect(call.id)}
                    >
                      {/* Main call info line */}
                      <div className="flex items-center space-x-3">
                        {/* Direction Icon */}
                        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                          {call.direction === 'outgoing' ? (
                            <PhoneOutgoing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          ) : call.direction === 'incoming' ? (
                            <PhoneIncoming className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>

                        {/* Phone Number */}
                        <div className="flex-1 min-w-0">
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100 font-mono truncate">
                            {call.direction === 'outgoing' 
                              ? (call.otherParty || call.callerNumber || 'Unknown') 
                              : (call.callerNumber || 'Unknown')
                            }
                          </span>
                        </div>

                            {/* Extension */}
                            <div className="flex items-center space-x-1 text-sm text-gray-700 dark:text-gray-300 shrink-0">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">Ext</span>
                              <span className="font-mono font-bold">
                                {call.agentExten || '-'}
                              </span>
                            </div>

                        {/* Direction Badge */}
                        <div className="shrink-0">
                          {call.direction ? (
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                              call.direction === 'outgoing'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            }`}>
                              {call.direction === 'outgoing' ? '📤 Out' : '📥 In'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              📞 -
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)} ${
                            ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase()) 
                              ? (call.direction === 'outgoing'
                                  ? 'animate-pulse ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-bold'
                                  : 'animate-pulse ring-2 ring-green-400 dark:ring-green-500 shadow-lg shadow-green-200 dark:shadow-green-900 bg-green-600 text-white dark:bg-green-500 dark:text-white font-bold')
                              : ''
                          }`}>
                            {(call.status === 'answered' || call.status === 'in_progress') && '✅'}
                            {call.status === 'completed' && '🏁'}
                            {(['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase())) && <RingingIcon />}
                            {call.status === 'busy' && '🚫'}
                            {(['no answer', 'no_answer', 'missed', 'failed'].includes(call.status.toLowerCase())) && '❌'}
                            {(['canceled', 'cancelled'].includes(call.status.toLowerCase())) && '🚫'}
                            {call.status === 'congestion' && '🌐'}
                            <span className="ml-2">{call.status.charAt(0).toUpperCase() + call.status.slice(1)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Second line: time and duration */}
                      <div className="mt-2 ml-7 flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(call.startTime)}</p>
                        </div>
                        
                        {/* Duration - Right side of start time */}
                        {call.duration && (
                          <div className="flex items-center space-x-1">
                            <Timer className="h-3 w-3 text-gray-400" />
                            <span className={`text-xs font-medium ${
                              call.direction === 'outgoing' 
                                ? 'text-indigo-600 dark:text-indigo-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {formatDuration(call.duration)}
                            </span>
                          </div>
                        )}
                        {!call.duration && (
                          <div className="flex items-center space-x-1">
                            <Timer className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">No duration</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneIncoming className="h-10 w-10 text-gray-400" />
                </div>
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">No Completed Calls</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">All calls are currently active or in progress</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistory;


