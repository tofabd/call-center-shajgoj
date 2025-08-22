import React, { useEffect, useState } from 'react';
import { ShoppingBag, Phone, Clock, User, Hash, X } from 'lucide-react';
import { callLogService, type CallDetails as ApiCallDetails } from '@services/callLogService';

interface CallDetailsProps {
  selectedCallId: number | null;
  isOpen: boolean;
  onClose: () => void;
  isManualSelection: boolean; // New prop to distinguish manual vs auto selection
}

export type { CallDetailsProps };

const CallDetails: React.FC<CallDetailsProps> = ({ selectedCallId, isOpen, onClose, isManualSelection }) => {
  const [details, setDetails] = useState<ApiCallDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

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

  // Handle modal open/close animations
  useEffect(() => {
    if (isOpen) {
      // Start animation immediately when modal opens
      setIsAnimating(true);
      // Use a minimal delay for the smoothest possible animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 10); // Very short delay for immediate visual feedback
      
      return () => clearTimeout(timer);
    }
    // Note: We don't reset isAnimating on close to allow for smooth exit animation
  }, [isOpen]);

  // Handle modal close animation
  const handleClose = () => {
    setIsAnimating(true);
    // Wait for exit animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 200); // Match the transition duration
  };

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset data when modal opens with new call - ONLY for manual selection
  useEffect(() => {
    if (isOpen && selectedCallId && isManualSelection) {
      setDetails(null);
      setError(null);
      setLoading(true);
      
      // Wait for modal animation to complete before loading data
      const timer = setTimeout(() => {
        callLogService
          .getCallDetails(selectedCallId)
          .then((d) => {
            setDetails(d);
          })
          .catch(() => {
            setError('Failed to load call details');
          })
          .finally(() => {
            setLoading(false);
          });
      }, 250); // Increased delay to match animation duration

      return () => clearTimeout(timer);
    }
  }, [selectedCallId, isOpen, isManualSelection]);

  // Listen for real-time call status updates - ONLY for manually selected calls
  useEffect(() => {
    if (!selectedCallId || !window.Echo || !isManualSelection) return;

    console.log('🔔 CallDetails: Setting up Echo listener for manually selected call ID:', selectedCallId);
    
    const channel = window.Echo.channel('call-console');
    
    const handleCallUpdate = (data: { id: number; status: string; duration?: number; [key: string]: unknown }) => {
      console.log('🔔 CallDetails: Received real-time update:', data);
      
      // Only update if this update is for the currently selected call
      if (data.id === selectedCallId) {
        console.log('✅ CallDetails: Updating details for manually selected call');
        
        // Refresh the call details from the server to get the latest data
        callLogService
          .getCallDetails(selectedCallId)
          .then((updatedDetails) => {
            setDetails(updatedDetails);
            console.log('🔄 CallDetails: Updated with fresh data from server');
          })
          .catch((error) => {
            console.error('❌ CallDetails: Failed to refresh call details:', error);
          });
      }
    };

    channel.listen('.call-updated', handleCallUpdate);

    return () => {
      console.log('🧹 CallDetails: Cleaning up Echo listener');
      // Note: We don't leave the channel as other components might be using it
    };
  }, [selectedCallId, isManualSelection]);

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-all duration-200 ease-out ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out transform ${
            isAnimating 
              ? 'opacity-0 scale-95 translate-y-2' 
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Call Details</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCallId && isManualSelection ? 'Details for selected call' : 'Select a call to view details'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className={`flex-1 min-h-0 overflow-y-auto narrow-scrollbar transition-all duration-300 ease-out ${
            isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}>
            {!selectedCallId || !isManualSelection ? (
              <div className="p-8 flex items-center justify-center h-full">
                <div className="text-center">
                  <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    {!isManualSelection 
                      ? 'Click on a call to manually select and view details' 
                      : 'Select a call from the Live Calls or Call Monitor to view details'
                    }
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="p-6">
                <div className="w-full space-y-6">
                  {/* Summary banner skeleton */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 mb-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                        <div className="h-7 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-5 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-28 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Sectioned details skeleton */}
                  <div className="space-y-3">
                    {/* Participants skeleton */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                      <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-3 animate-pulse"></div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Channel skeleton */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                      <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-3 animate-pulse"></div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timing skeleton */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                      <div className="h-4 w-14 bg-gray-300 dark:bg-gray-600 rounded mb-3 animate-pulse"></div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Identifiers skeleton */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                      <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-3 animate-pulse"></div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
                            (details.status || '').toLowerCase() === 'busy' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-200 dark:shadow-emerald-900/50' :
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
                    <div className="space-y-3">
                      {/* Participants */}
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-3 shadow-sm">
                        <h5 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Participants
                        </h5>
                        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Caller Name</dt>
                            <dd className="font-mono text-xs">{details.callerName || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Caller Number</dt>
                            <dd className="font-mono text-xs break-all">{details.callerNumber || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Other Party</dt>
                            <dd className="font-mono text-xs break-all">{details.otherParty || details.connectedLineNum || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Agent Ext</dt>
                            <dd className="font-mono text-xs">{details.agentExten || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Extension</dt>
                            <dd className="font-mono text-xs">{details.extension || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Direction</dt>
                            <dd className="capitalize text-xs">{details.direction || '-'}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Channel */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 shadow-sm">
                        <h5 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Channel
                        </h5>
                        <dl className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Channel</dt>
                            <dd className="font-mono text-xs break-all">{details.channel || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Context</dt>
                            <dd className="font-mono text-xs break-all">{details.context || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">State</dt>
                            <dd className="font-mono text-xs">{details.channelStateDesc || details.channelState || '-'}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Timing */}
                      <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-purple-900/20 p-3 shadow-sm">
                        <h5 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Timing
                        </h5>
                        <dl className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Start Time</dt>
                            <dd className="font-mono text-xs">{formatDateTime(details.startTime)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">End Time</dt>
                            <dd className="font-mono text-xs">{formatDateTime(details.endTime)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Duration</dt>
                            <dd className="font-mono text-xs">{typeof details.duration === 'number' ? formatDuration(details.duration) : '-'}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Identifiers */}
                      <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-3 shadow-sm">
                        <h5 className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          Identifiers
                        </h5>
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Unique ID</dt>
                            <dd className="font-mono text-xs break-all">{details.uniqueid || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Linked ID</dt>
                            <dd className="font-mono text-xs break-all">{details.linkedid || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Created</dt>
                            <dd className="font-mono text-xs">{formatDateTime(details.createdAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Updated</dt>
                            <dd className="font-mono text-xs">{formatDateTime(details.updatedAt)}</dd>
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
    </>
  );
};

export default CallDetails;
