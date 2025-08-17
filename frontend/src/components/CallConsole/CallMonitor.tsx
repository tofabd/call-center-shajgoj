import React from 'react';
import { PhoneIncoming, PhoneOutgoing, Clock, CirclePlus, CircleMinus } from 'lucide-react';

// Interface for unique call with frequency
interface UniqueCall {
  id: number;
  callerNumber: string;
  callerName: string | null;
  startTime: string;
  status: string;
  duration?: number;
  frequency: number;
  allCalls: Array<{
    id: number;
    callerNumber: string;
    callerName: string | null;
    startTime: string;
    endTime?: string;
    status: string;
    duration?: number;
    created_at: string;
  }>;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
}

interface CallMonitorProps {
  callLogs: UniqueCall[];
  selectedCallId: number | null;
  loading: boolean;
  error: string | null;
  echoConnected: boolean;
  expandedCalls: Set<string>;
  onCallSelect: (callId: number) => void;
  onToggleExpansion: (callerNumber: string) => void;
}

const CallMonitor: React.FC<CallMonitorProps> = ({
  callLogs,
  selectedCallId,
  loading,
  error,
  echoConnected,
  expandedCalls,
  onCallSelect,
  onToggleExpansion
}) => {
  // Force re-render when call data changes to ensure real-time updates
  React.useEffect(() => {
    // This effect ensures the component re-renders when callLogs change
    console.log('📊 CallMonitor: Call logs updated, count:', callLogs.length);
  }, [callLogs]);

  React.useEffect(() => {
    // Log when selectedCallId changes to track auto-selection
    if (selectedCallId) {
      console.log('🎯 CallMonitor: Selected call ID changed to:', selectedCallId);
    }
  }, [selectedCallId]);
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'answered':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'busy':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'no answer':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'ringing':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case 'started':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <PhoneIncoming className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Call Monitor</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Call Monitor in real-time</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${echoConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {echoConnected ? 'Live' : 'Offline'}
              </span>
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
                {callLogs
                  .sort((a, b) => {
                    // Priority order: ringing > started > answered > other statuses
                    const statusPriority = {
                      'ringing': 1,
                      'ring': 1,
                      'incoming': 1,
                      'calling': 1,
                      'started': 2,
                      'start': 2,
                      'answered': 3,
                      'busy': 4,
                      'no answer': 5
                    } as Record<string, number>;
                    const aPriority = statusPriority[a.status.toLowerCase()] || 6;
                    const bPriority = statusPriority[b.status.toLowerCase()] || 6;
                    if (aPriority === bPriority) {
                      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                    }
                    return aPriority - bPriority;
                  })
                  .map((call) => (
                    <div key={`${call.callerNumber}-${call.id}-${call.status}`} className="space-y-2">
                      {/* Main Call Item */}
                      <div
                        className={`group p-3 border rounded-xl transition-all duration-200 hover:shadow-md ${
                          selectedCallId === call.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                        } ${
                          ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase())
                            ? 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          {/* Left Column - Main Call Info */}
                          <div 
                            className="flex-1 min-w-0 cursor-pointer pr-4"
                            onClick={() => onCallSelect(call.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {call.direction === 'outgoing' ? (
                                  <PhoneOutgoing className="h-4 w-4 text-gray-600 dark:text-gray-300 flex-shrink-0" />
                                ) : (
                                  <PhoneIncoming className="h-4 w-4 text-gray-600 dark:text-gray-300 flex-shrink-0" />
                                )}
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-mono">
                                  {call.direction === 'outgoing' ? (call.otherParty || call.callerNumber || '-') : (call.callerNumber || '-')}
                                </span>
                              </div>
                              <div className="ml-2 flex-shrink-0 text-xs uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                Ext: <span className="font-mono">{call.agentExten || '-'}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(call.startTime)}
                              </p>
                              {call.duration && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {call.duration}s
                                  </p>
                                </>
                              )}
                              <span className="text-gray-400">•</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Latest call
                              </p>
                            </div>
                          </div>

                          {/* Right Column - Frequency, Status, Chevron */}
                          <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                            {/* Bottom Row  - Status Badge */}
                            <div className="h-6 flex items-center">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(call.status)} ${
                                ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(call.status.toLowerCase()) 
                                  ? 'animate-pulse ring-2 ring-blue-400 dark:ring-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900 bg-blue-600 text-white dark:bg-blue-500 dark:text-white font-bold' 
                                  : ''
                              }`}>
                                {call.status}
                              </span>
                            </div>
                            
                            {/* Top Row - Frequency Badge */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpansion(call.callerNumber);
                              }}
                              className="h-6 flex items-center">
                              {call.frequency > 1 && (
                                <div className="flex items-center space-x-1 px-2 py-1 text-xs rounded-full font-medium bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors duration-200 cursor-pointer group">
                                  <span>{call.frequency} calls</span>
                                  {expandedCalls.has(call.callerNumber) ? (
                                    <CircleMinus className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                                  ) : (
                                    <CirclePlus className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Expanded Call List */}
                        {expandedCalls.has(call.callerNumber) && call.frequency > 1 && (
                          <div className="mt-3 border-t border-gray-200 dark:border-gray-600 pt-3">
                            <div className="space-y-2">
                              {call.allCalls.slice(1).map((subCall, index) => (
                                <div
                                  key={subCall.id}
                                  className="group p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg transition-all duration-200 border-gray-200 dark:border-gray-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                          Call #{call.frequency - index - 1}
                                        </p>
                                        <span className="text-gray-400">•</span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {formatTime(subCall.startTime)}
                                        </p>
                                        {subCall.duration && (
                                          <>
                                            <span className="text-gray-400">•</span>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {subCall.duration}s
                                            </p>
                                          </>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateTime(subCall.created_at)}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium mb-1 ${getStatusColor(subCall.status)}`}>
                                        {subCall.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">No Incoming Calls</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Waiting for new calls...</p>
              </div>
            </div>
          )}
        </div>

        {/* Debug Panel */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between items-center">
              <span>Echo Status:</span>
              <span className={echoConnected ? 'text-green-600' : 'text-red-600'}>
                {echoConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span>Total Calls:</span>
              <span>{callLogs.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallMonitor;


