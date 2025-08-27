import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

import { callLogService } from '@services/callLogService';
import type { CallLog } from '@services/callLogService';
import socketService, { type CallUpdateEvent } from '@services/socketService';
// Removed WordPress/WooCommerce API imports
// MongoDB API supports real-time features via Socket.IO
// import '@services/echo'; // Import Echo setup (Laravel only)
// Removed WooCommerce order modals
import CallHistory from '@/components/CallConsole/CallHistory';
import LiveCalls from '@/components/CallConsole/LiveCalls';
import CallDetails from '@/components/CallConsole/CallDetailsModal';
import ExtensionsStatus from '@/components/CallConsole/ExtensionsStatus';
// Removed OrderNotesPanel

// Real-time interface disabled for MongoDB API
// interface CallStatusUpdateData {
//   id: number;
//   callerNumber: string;
//   callerName: string | null;
//   startTime: string;
//   endTime?: string;
//   status: string;
//   duration?: number;
//   exten?: string;
//   timestamp: string;
//   direction?: 'incoming' | 'outgoing';
//   agentExten?: string | null;
//   otherParty?: string | null;
// }

// Removed WordPress/WooCommerce-specific interfaces

const CallConsole: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]); // Changed to CallLog[] for individual calls
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [isCallDetailsModalOpen, setIsCallDetailsModalOpen] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Removed WooCommerce modal states
  // Removed WooCommerce notes states

  // Refs for cleanup  
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      setError(null);
      console.log('🚀 Fetching call data from MongoDB API...');
      
      const logs = await callLogService.getCallLogs();
      console.log('📊 Received call data:', logs);
      
      // Sort calls by start time (most recent first)
      const sortedLogs = logs.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      console.log('🔄 Setting call logs:', sortedLogs.length, 'individual calls');
      setCallLogs(sortedLogs);
    } catch (err) {
      console.error('❌ Error fetching call data:', err);
      setError('Failed to fetch call data from MongoDB API');
      setCallLogs([]);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  // Real-time Socket.IO setup for call updates
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchData(true);
    
    // Set up Socket.IO connection status monitoring
    const checkSocketConnection = () => {
      // Connection status check - removed unused variable
      socketService.isConnected();
    };
    
    // Check connection status every 5 seconds
    const connectionCheckInterval = setInterval(checkSocketConnection, 5000);
    checkSocketConnection(); // Initial check
    
    // Set up real-time call updates via Socket.IO
    socketService.onCallUpdated((callUpdate: CallUpdateEvent) => {
      console.log('🔔 Received real-time call update:', callUpdate);
      
      if (!isMountedRef.current) return;
      
      // Update the specific call in the list or add new one
      setCallLogs(prevLogs => {
        const callId = parseInt(callUpdate.id);
        const existingIndex = prevLogs.findIndex(call => call.id === callId);
        
        if (existingIndex >= 0) {
          // Update existing call
          const updatedLogs = [...prevLogs];
          updatedLogs[existingIndex] = {
            ...updatedLogs[existingIndex],
            status: callUpdate.status || updatedLogs[existingIndex].status,
            duration: callUpdate.duration || updatedLogs[existingIndex].duration,
            endTime: callUpdate.ended_at || updatedLogs[existingIndex].endTime,
            direction: callUpdate.direction || updatedLogs[existingIndex].direction,
            agentExten: callUpdate.agent_exten || updatedLogs[existingIndex].agentExten,
            otherParty: callUpdate.other_party || updatedLogs[existingIndex].otherParty
          };
          
          console.log('✅ Updated existing call:', callId);
          return updatedLogs;
        } else {
          // Add new call if it doesn't exist
          const newCall: CallLog = {
            id: callId,
            callerNumber: callUpdate.other_party || 'Unknown',
            callerName: null,
            startTime: callUpdate.started_at || new Date().toISOString(),
            endTime: callUpdate.ended_at,
            status: callUpdate.status || 'unknown',
            duration: callUpdate.duration,
            direction: callUpdate.direction,
            agentExten: callUpdate.agent_exten,
            otherParty: callUpdate.other_party
          };
          
          console.log('➕ Added new call:', callId);
          // Add to beginning and sort by start time
          const updatedLogs = [newCall, ...prevLogs].sort((a, b) => 
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
          return updatedLogs;
        }
      });
    });
    
    console.log('📡 CallHistory: Socket.IO real-time updates enabled');

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      if (isVisible) {
        console.log('📱 CallConsole page became visible, checking connections...');
        // Reconnect socket if needed
        if (!socketService.isConnected()) {
          socketService.reconnect();
        }
        // Refresh data
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      clearInterval(connectionCheckInterval);
      socketService.removeAllListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      console.log('🧹 CallHistory: Stopped real-time updates');
    };
  }, [fetchData]);

  // Debug useEffect to monitor selection
  useEffect(() => {
    if (selectedCallId) {
      console.log('🔍 Call selected:', selectedCallId, 'Manual:', isManualSelection);
    }
  }, [selectedCallId, isManualSelection]);

  // Real-time Echo listener disabled for MongoDB API
  // Set up real-time Echo listener for call updates (no auto-selection)
  // useEffect(() => {
  //   if (window.Echo) {
  //     console.log('🚀 Setting up Echo listener for call-console channel');
  //     setEchoConnected(true);
      
  //     // Listen to the public call-console channel for call status updates
  //     const channel = window.Echo.channel('call-console');
      
  //     // Clean call-level updates from the clean calls pipeline
  //     channel.listen('.call-updated', (data: CallStatusUpdateData) => {
  //       console.log('🔔 Received call-updated (clean) event:', data);
  //       setCallLogs(prevLogs => {
  //         const idx = prevLogs.findIndex(c => c.id === data.id);
  //         if (idx >= 0) {
  //           const updated = [...prevLogs];
  //           const existing = updated[idx];
  //           existing.status = data.status;
  //           existing.duration = data.duration;
  //           existing.startTime = data.startTime;
  //           existing.callerNumber = data.callerNumber;
  //           existing.callerName = data.callerName ?? null;
  //           if (data.direction !== undefined) existing.direction = data.direction;
  //           if (data.agentExten !== undefined) existing.agentExten = data.agentExten ?? null;
  //           if (data.otherParty !== undefined) existing.otherParty = data.otherParty ?? null;
  //           existing.allCalls[0] = {
  //             id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             endTime: data.endTime,
  //             status: data.status,
  //             duration: data.duration,
  //             created_at: data.timestamp,
  //           };
  //           return updated;
  //         } else {
  //           const newItem: UniqueCall = {
  //             id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             status: data.status,
  //             duration: data.duration,
  //             frequency: 1,
  //             allCalls: [{
  //               id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             endTime: data.endTime,
  //             status: data.status,
  //             duration: data.duration,
  //             created_at: data.timestamp,
  //           }],
  //             direction: data.direction,
  //             agentExten: data.agentExten ?? null,
  //             otherParty: data.otherParty ?? null,
  //           };
  //           return [newItem, ...prevLogs];
  //         }
  //       });
  //       // Removed auto-selection - calls are only selected manually now
  //     });

  //     // Test the connection
  //     console.log('📡 Echo channel setup complete, testing connection...');

  //     // Cleanup function
  //     return () => {
  //       console.log('🧹 Cleaning up Echo listener');
  //       window.Echo.leaveChannel('call-console');
  //       setEchoConnected(false);
  //     };
  //   } else {
  //     console.warn('⚠️ Window.Echo is not available');
  //     setEchoConnected(false);
  //   }
  // }, []);

  // Customer profile integration removed

  // Orders and notes queries removed

  // Manual refresh for CallHistory
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered for CallHistory');
    await fetchData(false);
  }, [fetchData]);

  // Function to handle call selection
  const handleCallSelect = async (callId: number) => {
    if (selectedCallId === callId) {
      // If same call is clicked, deselect it
      setSelectedCallId(null);
      setIsCallDetailsModalOpen(false);
      setIsManualSelection(false);
      return;
    }

    setSelectedCallId(callId);
    setIsManualSelection(true); // Mark as manual selection
    setIsCallDetailsModalOpen(true);
    
    // Customer profile integration removed
  };

  // Function to close call details modal
  const handleCloseCallDetailsModal = () => {
    setIsCallDetailsModalOpen(false);
    setSelectedCallId(null);
    setIsManualSelection(false);
  };

  // Customer selection removed

  // WooCommerce order handlers removed

  // Removed unused formatting helpers

  return (
    <Tooltip.Provider>
      <div className="bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)]">
      {/* WooCommerce modals removed */}

      <div className="flex gap-4 p-6 h-full overflow-hidden">
        {/* Left Column - Call Monitor (All Calls) */}
        <div className="flex-1 min-w-0">
          <CallHistory
            callLogs={callLogs} // Now passing individual calls
            selectedCallId={selectedCallId}
            loading={loading}
            error={error}
            onCallSelect={handleCallSelect}
            onRefresh={handleManualRefresh}
          />
        </div>

        {/* Center Column - Live Calls */}
        <div className="flex-1 min-w-0">
          <LiveCalls
            selectedCallId={selectedCallId ? selectedCallId.toString() : null}
            onCallSelect={(callId: string) => handleCallSelect(parseInt(callId))}
          />
        </div>

        {/* Right Column: Extensions Status */}
        <div className="flex-1 min-w-0">
          <ExtensionsStatus />
        </div>
      </div>

      {/* Call Details Modal */}
      <CallDetails
        selectedCallId={selectedCallId}
        isOpen={isCallDetailsModalOpen}
        onClose={handleCloseCallDetailsModal}
        isManualSelection={isManualSelection}
      />
      </div>
    </Tooltip.Provider>
  );
};

export default CallConsole;