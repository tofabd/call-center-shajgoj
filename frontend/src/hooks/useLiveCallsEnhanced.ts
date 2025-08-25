import { useState, useEffect, useCallback, useRef } from 'react';
import { callService, type LiveCall } from '../services/callService';

interface UseLiveCallsOptions {
  pollInterval?: number; // Polling interval in milliseconds
  autoRefresh?: boolean; // Whether to auto-refresh
  onError?: (error: string) => void; // Error callback
  onDataUpdate?: (calls: LiveCall[]) => void; // Data update callback
}

interface UseLiveCallsReturn {
  liveCalls: LiveCall[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  activeCalls: LiveCall[];
  ringingCalls: LiveCall[];
  answeredCalls: LiveCall[];
  refetch: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

export const useLiveCallsEnhanced = (options: UseLiveCallsOptions = {}): UseLiveCallsReturn => {
  const {
    pollInterval = 2000, // Default 2 seconds for better real-time feeling
    autoRefresh = true,
    onError,
    onDataUpdate
  } = options;

  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(autoRefresh);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch live calls function
  const fetchLiveCalls = useCallback(async () => {
    try {
      if (!isMountedRef.current) return;
      
      setError(null);
      const calls = await callService.getLiveCalls();
      
      if (!isMountedRef.current) return;
      
      setLiveCalls(calls);
      setLastUpdated(new Date());
      setLoading(false);
      
      // Call data update callback
      if (onDataUpdate) {
        onDataUpdate(calls);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load live calls';
      setError(errorMessage);
      setLoading(false);
      
      // Call error callback
      if (onError) {
        onError(errorMessage);
      }
      
      console.error('Error fetching live calls:', err);
    }
  }, []); // Remove dependencies to prevent recreation

  // Start polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    setIsPolling(true);
    pollIntervalRef.current = setInterval(fetchLiveCalls, pollInterval);
  }, [fetchLiveCalls]); // Keep minimal dependencies

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Manual refetch
  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchLiveCalls();
  }, [fetchLiveCalls]);

  // Initialize and handle auto-refresh
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchLiveCalls();
    
    // Start polling if auto-refresh is enabled
    if (autoRefresh) {
      const interval = setInterval(fetchLiveCalls, pollInterval);
      pollIntervalRef.current = interval;
      setIsPolling(true);
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, []); // Remove all dependencies to run only once

  // Handle visibility change to pause/resume polling when tab is not active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!pollIntervalRef.current) return;
      
      if (document.hidden) {
        // Tab is not visible, reduce polling frequency
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(fetchLiveCalls, pollInterval * 2); // Double the interval
      } else {
        // Tab is visible, resume normal polling
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(fetchLiveCalls, pollInterval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // Remove dependencies

  // Computed values
  const activeCalls = liveCalls.filter(call => {
    const status = call.status.toLowerCase();
    return ['ringing', 'answered', 'ring', 'calling', 'incoming', 'started', 'start', 'in_progress'].includes(status);
  });

  const ringingCalls = liveCalls.filter(call => {
    const status = call.status.toLowerCase();
    return ['ringing', 'ring', 'calling', 'incoming', 'started', 'start'].includes(status);
  });

  const answeredCalls = liveCalls.filter(call => {
    const status = call.status.toLowerCase();
    return ['answered', 'in_progress'].includes(status);
  });

  return {
    liveCalls,
    loading,
    error,
    lastUpdated,
    activeCalls,
    ringingCalls,
    answeredCalls,
    refetch,
    startPolling,
    stopPolling,
    isPolling
  };
};