import React, { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { callLogService, type CallDetails as ApiCallDetails } from '@services/callLogService';

interface CallDetailsProps {
  selectedCallId: number | null;
}

export type { CallDetailsProps };

const CallDetails: React.FC<CallDetailsProps> = ({ selectedCallId }) => {
  const [details, setDetails] = useState<ApiCallDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedCallId) {
      setDetails(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    callLogService
      .getCallDetails(selectedCallId)
      .then((d) => {
        if (isMounted) setDetails(d);
      })
      .catch(() => {
        if (isMounted) setError('Failed to load call details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCallId]);
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Call Details</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCallId ? 'Details for selected call' : 'Select a call to view details'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto narrow-scrollbar">
        {!selectedCallId ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
              <p className="text-gray-500 dark:text-gray-400">Select a call from the incoming calls list to view details</p>
            </div>
          </div>
        ) : loading ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 dark:border-blue-400/20 border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="w-full space-y-6">
              {/* Summary banner */}
              {details && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 p-4 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 text-xs rounded-full font-semibold shadow-sm ${
                          details.direction === 'outgoing' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-200 dark:shadow-indigo-900/50' :
                          details.direction === 'incoming' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200 dark:shadow-emerald-900/50' :
                          'bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-gray-200 dark:shadow-gray-900/50'
                        }`}>
                          {details.direction ? details.direction.charAt(0).toUpperCase() + details.direction.slice(1) : 'Unknown'}
                        </span>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">{details.callerNumber || 'Unknown number'}</span>
                      {details.agentExten || details.extension ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">→ Ext <span className="font-mono font-semibold">{details.agentExten || details.extension}</span></span>
                      ) : null}
                      {details.otherParty || details.connectedLineNum ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">with <span className="font-mono font-semibold">{details.otherParty || details.connectedLineNum}</span></span>
                      ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                        <span>Started: <span className="font-mono">{formatDateTime(details.startTime)}</span></span>
                        {typeof details.duration === 'number' && (
                          <>
                            <span>•</span>
                            <span>Duration: <span className="font-mono">{formatDuration(details.duration)}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1.5 text-sm rounded-full font-bold shadow-md ${
                        (details.status || '').toLowerCase() === 'answered' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-200 dark:shadow-emerald-900/50' :
                        (details.status || '').toLowerCase() === 'busy' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-200 dark:shadow-rose-900/50' :
                        (details.status || '').toLowerCase().includes('ring') ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-blue-200 dark:shadow-blue-900/50 animate-pulse' :
                        (details.status || '').toLowerCase() === 'started' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-violet-200 dark:shadow-violet-900/50' :
                        'bg-gradient-to-r from-gray-500 to-slate-600 text-white shadow-gray-200 dark:shadow-gray-900/50'
                      }`}>{details.status || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sectioned details */}
              {details && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {/* Participants */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-900/20">
                    <h5 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      Participants
                    </h5>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Caller Name</dt>
                        <dd className="font-mono">{details.callerName || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Caller Number</dt>
                        <dd className="font-mono break-all">{details.callerNumber || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Other Party</dt>
                        <dd className="font-mono break-all">{details.otherParty || details.connectedLineNum || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Agent Extension</dt>
                        <dd className="font-mono">{details.agentExten || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Extension (Dialed)</dt>
                        <dd className="font-mono">{details.extension || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Direction</dt>
                        <dd className="capitalize">{details.direction || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Channel */}
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20">
                    <h5 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Channel
                    </h5>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Channel</dt>
                        <dd className="font-mono break-all">{details.channel || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Context</dt>
                        <dd className="font-mono break-all">{details.context || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">State</dt>
                        <dd className="font-mono">{details.channelStateDesc || details.channelState || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Timing */}
                  <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 shadow-lg shadow-purple-100/50 dark:shadow-purple-900/20">
                    <h5 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      Timing
                    </h5>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Start Time</dt>
                        <dd className="font-mono">{formatDateTime(details.startTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">End Time</dt>
                        <dd className="font-mono">{formatDateTime(details.endTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Duration</dt>
                        <dd className="font-mono">{typeof details.duration === 'number' ? formatDuration(details.duration) : '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Identifiers */}
                  <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 shadow-lg shadow-orange-100/50 dark:shadow-orange-900/20">
                    <h5 className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      Identifiers
                    </h5>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Unique ID</dt>
                        <dd className="font-mono break-all">{details.uniqueid || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Linked ID</dt>
                        <dd className="font-mono break-all">{details.linkedid || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Created At</dt>
                        <dd className="font-mono">{formatDateTime(details.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 dark:text-gray-400">Updated At</dt>
                        <dd className="font-mono">{formatDateTime(details.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default CallDetails;


