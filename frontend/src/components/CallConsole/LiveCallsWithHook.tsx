import React, { useEffect, useState } from 'react';
import { Phone, PhoneCall, Clock, PhoneIncoming, PhoneOutgoing, Timer } from 'lucide-react';
import { useLiveCalls } from '../../hooks/useLiveCalls';

interface LiveCallsProps {
  selectedCallId: number | null;
  onCallSelect: (callId: number) => void;
  echoConnected: boolean;
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
    <span className="inline-flex items-center ml-1">
      {isPhoneCall ? (
        <PhoneCall className="h-4 w-4 animate-pulse text-white" />
      ) : (
        <Phone className="h-4 w-4 animate-pulse text-white" />
      )}
    </span>
  );
};

const LiveCalls: React.FC<LiveCallsProps> = ({
  selectedCallId,
  onCallSelect,
  echoConnected
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Use the custom hook for live calls data
  const { activeCalls, loading, error, refresh, lastUpdate } = useLiveCalls({
    pollInterval: 3000, // Poll every 3 seconds
    autoStart: true
  });

  // Update current time every second for real-time duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
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
        ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300'
        : 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    }
    
    if (['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(baseStatus)) {
      return direction === 'outgoing'
        ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300'
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

  // Sort active calls by priority and time
  const sortedActiveCalls = activeCalls.sort((a, b) => {
    const aPriority = getStatusPriority(a.status);
    const bPriority = getStatusPriority(b.status);
    
    if (aPriority === bPriority) {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    }
    return aPriority - bPriority;
  });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Calls</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active calls in progress {lastUpdate && `(Updated: ${lastUpdate.toLocaleTimeString()})`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${echoConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {echoConnected ? 'Live' : 'Polling'}
              </span>
              <button 
                onClick={refresh}
                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded"
                disabled={loading}
              >
                {loading ? '...' : '🔄'}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && activeCalls.length === 0 ? (
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
                <button 
                  onClick={refresh}
                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : sortedActiveCalls.length > 0 ? (
            <div className="flex-1 overflow-y-auto narrow-scrollbar">
              <div className="p-4 space-y-3">
                {sortedActiveCalls.map((call) => (
                  <div
                    key={`${call.id}-${call.status}`}
                    className={`group p-4 border rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer min-h-[80px] flex flex-col justify-center ${
                      selectedCallId === parseInt(call.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : (() => {
                            const status = call.status.toLowerCase();
                            const direction = call.direction;
                            
                            if (['answered', 'in_progress'].includes(status)) {
                              return direction === 'outgoing'
                                ? 'border-indigo-300 dark:border-indigo-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20'
                                : 'border-emerald-300 dark:border-emerald-700 bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20';
                            }
                            if (['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(status)) {
                              return direction === 'outgoing'
                                ? 'border-indigo-300 dark:border-indigo-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-l-4 border-l-indigo-500'
                                : 'border-emerald-300 dark:border-emerald-700 bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-l-4 border-l-emerald-500';
                            }
                            return 'border-gray-200 dark:border-gray-600 bg-linear-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800';
                          })()
                    }`}
                    onClick={() => onCallSelect(parseInt(call.id))}
                  >
                    {/* Main call info */}
                    <div className="flex items-center space-x-3">
                      {/* Direction Icon */}
                      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                        {call.direction === 'outgoing' ? (
                          <PhoneOutgoing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        ) : call.direction === 'incoming' ? (
                          <PhoneIncoming className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
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
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status, call.direction)} ${
                          ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase()) 
                            ? (call.direction === 'outgoing'
                                ? 'animate-pulse ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white font-bold'
                                : 'animate-pulse ring-2 ring-emerald-400 dark:ring-emerald-500 shadow-lg shadow-emerald-200 dark:shadow-emerald-900 bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white font-bold')
                            : ''
                        }`}>
                          {(call.status === 'answered' || call.status === 'in_progress') && '✅'}
                          {(['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase())) && <RingingIcon />}
                          <span className="ml-2">{call.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Second line: time and duration on same row */}
                    <div className="mt-2 ml-7 flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(call.startTime)}</p>
                      </div>
                      
                      {/* Duration - Right side of start time */}
                      <div className="flex items-center space-x-1">
                        <Timer className="h-3 w-3 text-gray-400" />
                        <span className={`text-xs font-medium ${
                          call.direction === 'outgoing' 
                            ? 'text-indigo-600 dark:text-indigo-400' 
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {getRealTimeDuration(call.startTime)}
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