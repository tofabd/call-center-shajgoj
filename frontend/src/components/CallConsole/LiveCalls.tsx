import React, { useEffect, useState, useCallback } from 'react';
import { Phone, PhoneCall, Clock, PhoneIncoming, PhoneOutgoing, Timer, RefreshCw } from 'lucide-react';
import socketService from '../../services/socketService';
import type { CallUpdateEvent } from '../../services/socketService';
import type { LiveCall } from '../../services/callService';

interface LiveCallsProps {
  selectedCallId: string | null; // Changed to string since MongoDB IDs are strings
  onCallSelect: (callId: string) => void; // Changed to string
}

// Animated ringing icon component
const RingingIcon: React.FC = () => {
  const [isPhoneCall, setIsPhoneCall] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsPhoneCall(prev => !prev);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center justify-center ml-1 mr-1 ringing-icon">
      {isPhoneCall ? (
        <PhoneCall className="h-4 w-4 text-white drop-shadow-sm filter" />
      ) : (
        <Phone className="h-4 w-4 text-white drop-shadow-sm filter" />
      )}
    </span>
  );
};

const LiveCalls: React.FC<LiveCallsProps> = ({
  selectedCallId,
  onCallSelect
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Real-time state management (replacing useLiveCallsEnhanced)
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Real-time connection and data management
  useEffect(() => {
    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Import callService dynamically to avoid circular dependencies
        const { callService } = await import('../../services/callService');
        const calls = await callService.getLiveCalls();
        setLiveCalls(calls);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        console.error('Error fetching initial live calls:', err);
        setError('Failed to load live calls');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to real-time call updates
    const handleCallUpdate = (update: CallUpdateEvent) => {
      console.log('📞 Real-time call update received:', update);
      setLastUpdated(new Date());
      
      setLiveCalls(prevCalls => {
        // Find existing call or add new one
        const existingIndex = prevCalls.findIndex(call => 
          call.id === update.id || call.linkedid === update.linkedid
        );
        
        if (existingIndex >= 0) {
          // Update existing call
          const updatedCalls = [...prevCalls];
          const existingCall = updatedCalls[existingIndex];
          updatedCalls[existingIndex] = {
            ...existingCall,
            // Update only the fields from the update event
            status: (update.status as LiveCall['status']) || existingCall.status,
            direction: update.direction || existingCall.direction,
            other_party: update.other_party || existingCall.other_party,
            agent_exten: update.agent_exten || existingCall.agent_exten,
            started_at: update.started_at || existingCall.started_at,
            answered_at: update.answered_at || existingCall.answered_at,
            ended_at: update.ended_at || existingCall.ended_at,
            duration: update.duration || existingCall.duration,
            updatedAt: update.timestamp || new Date().toISOString()
          };
          return updatedCalls;
        } else {
          // Add new call if it's active
          const activeStatuses = ['ringing', 'answered', 'ring', 'calling', 'incoming', 'started', 'start', 'in_progress'];
          if (activeStatuses.includes(update.status?.toLowerCase() || '')) {
            const newCall: LiveCall = {
              _id: update.id,
              id: update.id,
              linkedid: update.linkedid,
              direction: update.direction,
              other_party: update.other_party,
              agent_exten: update.agent_exten,
              started_at: update.started_at || new Date().toISOString(),
              answered_at: update.answered_at,
              ended_at: update.ended_at,
              status: 'ringing', // Default to ringing for new calls
              caller_number: update.other_party || 'Unknown',
              duration: update.duration,
              createdAt: update.timestamp || new Date().toISOString(),
              updatedAt: update.timestamp || new Date().toISOString()
            };
            return [...prevCalls, newCall];
          }
          return prevCalls;
        }
      });
    };

    // Monitor connection status
    const checkConnection = () => {
      setIsConnected(socketService.isConnected() || false);
    };

    // Initial connection check
    checkConnection();
    
    // Subscribe to call updates
    socketService.onCallUpdated(handleCallUpdate);
    
    // Monitor connection status every 5 seconds
    const connectionInterval = setInterval(checkConnection, 5000);
    
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        console.log('📱 Page became visible, checking live calls connection...');
        // Reconnect socket if needed
        if (!socketService.isConnected()) {
          socketService.reconnect();
        }
        // Force refresh data
        handleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      socketService.removeAllListeners();
      clearInterval(connectionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Update current time every second for real-time duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Computed values (replacing hook return values)
  const activeCalls = liveCalls.filter(call => {
    const status = call.status?.toLowerCase() || '';
    return ['ringing', 'answered', 'ring', 'calling', 'incoming', 'started', 'start', 'in_progress'].includes(status);
  });

  const ringingCalls = liveCalls.filter(call => {
    const status = call.status?.toLowerCase() || '';
    return ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(status);
  });

  const answeredCalls = liveCalls.filter(call => {
    const status = call.status?.toLowerCase() || '';
    return ['answered', 'in_progress'].includes(status);
  });

  // Manual refresh handler with new design pattern
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    setIsRefreshing(true);
    try {
      setError(null);
      const { callService } = await import('../../services/callService');
      const calls = await callService.getLiveCalls();
      setLiveCalls(calls);
      setLastUpdated(new Date());
      console.log('🔄 Manual refresh completed:', calls.length, 'calls');
    } catch (err) {
      console.error('Manual refresh error:', err);
      setError('Failed to refresh live calls');
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000); // Keep spinning for visual feedback
    }
  }, []);

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

  const getRealTimeDuration = (startTime: string): string => {
    const start = new Date(startTime);
    const duration = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    return formatDuration(duration);
  };

  const getStatusColor = (status: string, direction?: 'incoming' | 'outgoing') => {
    const baseStatus = status.toLowerCase();
    
    if (['answered', 'in_progress'].includes(baseStatus)) {
      return direction === 'outgoing' 
        ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300'
        : 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    }
    
    if (['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(baseStatus)) {
      return direction === 'outgoing'
        ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300'
        : 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    }
    
    return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300';
  };

  const getStatusPriority = (status: string): number => {
    const statusPriority = {
      'ringing': 1,
      'ring': 1,
      'incoming': 1,
      'calling': 1,
      'started': 2,
      'start': 2,
      'answered': 3,
      'in_progress': 3,
    } as Record<string, number>;
    
    return statusPriority[status.toLowerCase()] || 999;
  };

  // Sort activeCalls and remove unused variable
  const sortedCalls = activeCalls.sort((a, b) => {
    const aPriority = getStatusPriority(a.status);
    const bPriority = getStatusPriority(b.status);
    
    if (aPriority === bPriority) {
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    }
    return aPriority - bPriority;
  });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Calls</h3>
              <div className="flex items-center space-x-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {activeCalls.length} active • {ringingCalls.length} ringing • {answeredCalls.length} answered
                </p>
                {lastUpdated && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center space-x-2">
              {/* Refresh Button with TodayStatistics Design */}
              <button
                onClick={handleRefresh}
                className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                  isRefreshing
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
                }`}
                title={isRefreshing ? 'Refreshing...' : 'Click to refresh live calls'}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                  isRefreshing
                    ? 'text-blue-600 dark:text-blue-400 animate-spin'
                    : 'text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 group-hover:scale-110'
                }`} />
              </button>
              
              {/* Real-time status indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && liveCalls.length === 0 ? (
            <div className="flex items-center justify-center flex-1 p-6">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Loading live calls...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center flex-1 p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                <div className="flex space-x-3 mt-3">
                  <button 
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : activeCalls.length > 0 ? (
            <div className="flex-1 overflow-y-auto narrow-scrollbar">
              <div className="p-4 space-y-3">
                {sortedCalls.map((call) => (
                  <div
                    key={`${call.id || call._id}-${call.status}`}
                    className={`group p-4 border rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer min-h-[80px] flex flex-col justify-center ${
                      selectedCallId === call.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : (() => {
                            const status = call.status.toLowerCase();
                            const direction = call.direction;
                            
                            if (['answered', 'in_progress'].includes(status)) {
                              return direction === 'outgoing'
                                ? 'border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20'
                                : 'border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20';
                            }
                            if (['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(status)) {
                              return direction === 'outgoing'
                                ? 'border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-l-4 border-l-indigo-500'
                                : 'border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-l-4 border-l-green-500';
                            }
                            return 'border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800';
                          })()
                    }`}
                    onClick={() => onCallSelect(call.id)}
                  >
                    {/* Main call info */}
                    <div className="flex items-center space-x-3">
                      {/* Direction Icon */}
                      <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
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
                            ? (call.other_party || call.caller_number || 'Unknown') 
                            : (call.caller_number || 'Unknown')
                          }
                        </span>
                      </div>

                      {/* Extension */}
                      <div className="flex items-center space-x-1 text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Ext</span>
                        <span className="font-mono font-bold">
                          {call.agent_exten || '-'}
                        </span>
                      </div>

                      {/* Direction Badge */}
                      <div className="flex-shrink-0">
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
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-full min-w-[80px] justify-center ${getStatusColor(call.status, call.direction)} ${
                          ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase()) 
                            ? (call.direction === 'outgoing'
                                ? 'animate-pulse ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-bold ringing-badge'
                                : 'animate-pulse ring-2 ring-green-400 dark:ring-green-500 shadow-lg shadow-green-200 dark:shadow-green-900 bg-green-600 text-white dark:bg-green-500 dark:text-white font-bold ringing-badge')
                            : ''
                        }`}>
                          {(call.status === 'answered') && <span className="mr-1">✅</span>}
                          {(['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase())) && <RingingIcon />}
                          <span className={(['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase())) ? "ml-1 font-bold" : "ml-2"}>
                            {call.status.toLowerCase() === 'ringing' ? 'Ringing' : 
                             call.status.toLowerCase() === 'ring' ? 'Ringing' :
                             call.status.toLowerCase() === 'calling' ? 'Calling' :
                             call.status.toLowerCase() === 'incoming' ? 'Incoming' :
                             call.status.toLowerCase() === 'started' ? 'Started' :
                             call.status.toLowerCase() === 'start' ? 'Started' :
                             call.status.toLowerCase() === 'answered' ? 'Answered' :
                             call.status.toLowerCase() === 'in_progress' ? 'In Progress' :
                             call.status}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Second line: time and duration on same row */}
                    <div className="mt-2 ml-7 flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(call.started_at)}
                        </p>
                      </div>
                      
                      {/* Duration - Right side of start time */}
                      <div className="flex items-center space-x-1">
                        <Timer className="h-3 w-3 text-gray-400" />
                        <span className={`text-xs font-medium ${
                          call.direction === 'outgoing' 
                            ? 'text-indigo-600 dark:text-indigo-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {getRealTimeDuration(call.started_at)}
                        </span>
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
                  <Phone className="h-10 w-10 text-gray-400" />
                </div>
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">No Active Calls</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">All calls are completed or inactive</p>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default LiveCalls;
