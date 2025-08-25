import { useState, useEffect, useCallback } from 'react';
import { callService, type LiveCall } from '../services/callService';

export interface UseLiveCallsOptions {
  pollInterval?: number; // Polling interval in milliseconds
  autoStart?: boolean;   // Whether to start polling automatically
}

export const useLiveCalls = (options: UseLiveCallsOptions = {}) => {
  const { pollInterval = 3000, autoStart = true } = options;
  
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadLiveCalls = useCallback(async () => {
    try {
      const calls = await callService.getLiveCalls();
      setLiveCalls(calls);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error loading live calls:', err);
      setError('Failed to load live calls');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    loadLiveCalls();
  }, [loadLiveCalls]);

  useEffect(() => {
    if (!autoStart) return;

    // Initial load
    loadLiveCalls();
    
    // Set up polling
    const interval = setInterval(loadLiveCalls, pollInterval);
    
    return () => clearInterval(interval);
  }, [loadLiveCalls, pollInterval, autoStart]);

  // Filter active calls
  const activeCalls = liveCalls.filter(call => {
    const status = call.status.toLowerCase();
    return [
      'ringing', 'ring', 'calling', 'incoming', 
      'started', 'start', 'answered', 'in_progress'
    ].includes(status);
  });

  return {
    liveCalls,
    activeCalls,
    loading,
    error,
    lastUpdate,
    refresh,
    count: activeCalls.length
  };
};