import React from 'react';
import { X, Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ExtensionCallStats } from '../../services/extensionService';

interface ExtensionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ExtensionCallStats | null;
  loading: boolean;
  error: string | null;
}

const ExtensionStatsModal: React.FC<ExtensionStatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  loading,
  error
}) => {
  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'answered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'busy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_answer':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'congestion':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
        return 'text-green-600 dark:text-green-400';
      case 'busy':
        return 'text-red-600 dark:text-red-400';
      case 'no_answer':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'canceled':
        return 'text-gray-600 dark:text-gray-400';
      case 'congestion':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Call Statistics
                  </h3>
                  {stats && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.agentName} • {stats.date}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Calls</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                      {stats.summary.totalCalls}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Answered</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
                      {stats.summary.answeredCalls}
                    </p>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Missed</span>
                    </div>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-2">
                      {stats.summary.missedCalls}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Answer Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                      {stats.summary.answerRate}%
                    </p>
                  </div>
                </div>

                {/* Direction and Status Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Direction Breakdown */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Direction</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <PhoneIncoming className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Incoming</span>
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {stats.byDirection.incoming}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Outgoing</span>
                        </div>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {stats.byDirection.outgoing}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(status)}
                            <span className={`text-sm capitalize ${getStatusColor(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Ring Time</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatDuration(stats.averages.ringTime)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Talk Time</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatDuration(stats.averages.talkTime)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Talk Time</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatDuration(stats.averages.totalTalkTime)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Calls */}
                {stats.recentCalls.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Calls</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {stats.recentCalls.map((call) => (
                        <div key={call.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(call.status)}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {call.caller_name || call.caller_number || call.other_party || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {call.direction && (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    call.direction === 'incoming' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  }`}>
                                    {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-900 dark:text-white">
                              {formatTime(call.started_at)}
                            </p>
                            {call.talk_seconds && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDuration(call.talk_seconds)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionStatsModal;
