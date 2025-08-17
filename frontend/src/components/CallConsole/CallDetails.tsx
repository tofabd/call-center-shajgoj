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

        {!selectedCallId ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-gray-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
              <p className="text-gray-500 dark:text-gray-400">Select a call from the incoming calls list to view details</p>
            </div>
          </div>
        ) : loading ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
                <div className="absolute inset-1 rounded-full border-4 border-blue-200 dark:border-blue-900 border-b-transparent animate-spin"></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-blue-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">Call Details</h4>
              {details && (
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {details.direction === 'incoming' ? (
                    <p>
                      Incoming call from <span className="font-semibold">{details.callerNumber ?? 'Unknown'}</span>
                      {details.agentExten || details.extension ? (
                        <> to extension <span className="font-semibold">{details.agentExten || details.extension}</span></>
                      ) : null}
                    </p>
                  ) : details.direction === 'outgoing' ? (
                    <p>
                      Outgoing call from extension <span className="font-semibold">{details.agentExten || details.extension || 'Unknown'}</span>
                      {details.otherParty || details.connectedLineNum ? (
                        <> to <span className="font-semibold">{details.otherParty || details.connectedLineNum}</span></>
                      ) : null}
                    </p>
                  ) : (
                    <p>Direction: <span className="font-semibold">Unknown</span></p>
                  )}
                  <p>Status: <span className="font-semibold capitalize">{details.status}</span></p>
                  {typeof details.duration === 'number' && (
                    <p>Duration: <span className="font-semibold">{formatDuration(details.duration)}</span></p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallDetails;


