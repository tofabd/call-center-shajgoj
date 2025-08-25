import React, { useState, useEffect } from 'react';

import { callLogService } from '@services/callLogService';
import type { CallLog } from '@services/callLogService';
// Removed WordPress/WooCommerce API imports
// MongoDB API doesn't support real-time features, so Echo is disabled
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

const CallConsole: React.FC = () => {
  const [callLogs, setCallLogs] = useState<UniqueCall[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [isCallDetailsModalOpen, setIsCallDetailsModalOpen] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  // Real-time Echo connection state disabled for MongoDB API
  // const [echoConnected, setEchoConnected] = useState(false);
  // Removed WooCommerce modal states
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  // Removed WooCommerce notes states

  // Transform flat call logs into grouped unique calls for UI
  const transformToUniqueCalls = (logs: CallLog[]): UniqueCall[] => {
    if (!logs || logs.length === 0) {
      console.log('📭 No call logs received');
      return [];
    }

    console.log('🔄 Transforming call logs:', logs.length, 'calls');
    
    // Group calls by caller number for frequency calculation
    const callsByNumber = logs.reduce((acc, call) => {
      const key = call.callerNumber || 'unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(call);
      return acc;
    }, {} as Record<string, CallLog[]>);

    // Transform to UniqueCall format
    const transformed = Object.entries(callsByNumber).map(([callerNumber, calls]) => {
      const sortedCalls = calls.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      const latestCall = sortedCalls[0];
      
      return {
        id: latestCall.id,
        callerNumber: callerNumber,
        callerName: latestCall.callerName,
        startTime: latestCall.startTime,
        status: latestCall.status,
        duration: latestCall.duration,
        frequency: calls.length,
        allCalls: sortedCalls.map(call => ({
          id: call.id,
          callerNumber: call.callerNumber,
          callerName: call.callerName,
          startTime: call.startTime,
          endTime: call.endTime,
          status: call.status,
          duration: call.duration,
          created_at: call.startTime,
        })),
        direction: latestCall.direction,
        agentExten: latestCall.agentExten,
        otherParty: latestCall.otherParty
      };
    });

    console.log('✅ Transformed to unique calls:', transformed.length);
    return transformed;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🚀 Fetching call data from MongoDB API...');
        
        const logs = await callLogService.getCallLogs();
        console.log('📊 Received call data:', logs);
        
        const transformed = transformToUniqueCalls(logs);
        console.log('🔄 Setting call logs:', transformed.length, 'unique calls');
        
        setCallLogs(transformed);
      } catch (err) {
        console.error('❌ Error fetching call data:', err);
        setError('Failed to fetch call data from MongoDB API');
        setCallLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
  //               callerNumber: data.callerNumber,
  //               callerName: data.callerName,
  //               startTime: data.startTime,
  //               endTime: data.endTime,
  //               status: data.status,
  //               duration: data.duration,
  //               created_at: data.timestamp,
  //             }],
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

  // Function to toggle call expansion
  const toggleCallExpansion = (callerNumber: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callerNumber)) {
        newSet.delete(callerNumber);
      } else {
        newSet.add(callerNumber);
      }
      return newSet;
    });
  };

  // Customer selection removed

  // WooCommerce order handlers removed

  // Removed unused formatting helpers

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)]">
      {/* WooCommerce modals removed */}

      <div className="flex gap-4 p-6 h-full overflow-hidden">
        {/* Left Column - Call Monitor (Completed/Inactive Calls) */}
        <div className="flex-1 min-w-0">
          <CallHistory
            callLogs={callLogs}
            selectedCallId={selectedCallId}
            loading={loading}
            error={error}
            echoConnected={false} // Real-time disabled for MongoDB API
            expandedCalls={expandedCalls}
            onCallSelect={handleCallSelect}
            onToggleExpansion={toggleCallExpansion}
          />
        </div>

        {/* Center Column - Live Calls */}
        <div className="flex-1 min-w-0">
          <LiveCalls
            selectedCallId={selectedCallId ? selectedCallId.toString() : null}
            onCallSelect={(callId: string) => handleCallSelect(parseInt(callId))}
            echoConnected={false} // Real-time disabled for MongoDB API
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
  );
};

export default CallConsole;