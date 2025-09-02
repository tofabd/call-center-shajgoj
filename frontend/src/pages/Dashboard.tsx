import React, { useState, useEffect, useCallback } from 'react';
import TimeRangeSelector from '@/components/Dashboard/TimeRangeSelector';
import UnifiedStatistics from '@/components/Dashboard/UnifiedStatistics';
import { callLogService } from '@services/callLogService';
import type { PeriodStats, TimeRange } from '@services/callLogService';

const Dashboard: React.FC = () => {
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('today');
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7); // Default to last 7 days
    return { start, end };
  });

  const fetchStats = async (timeRange: TimeRange = activeTimeRange, customDates?: { start: Date; end: Date }) => {
    try {
      setLoading(true);
      setError(null);
      
      let statsData: PeriodStats;
      
      if (timeRange === 'custom' && customDates) {
        statsData = await callLogService.getStatsByRange(timeRange, customDates);
      } else {
        statsData = await callLogService.getStatsByRange(timeRange);
      }
      
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(`Failed to load ${timeRange} statistics`);
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh function - updates data without loading state
  const silentRefresh = useCallback(async () => {
    try {
      let statsData: PeriodStats;
      
      if (activeTimeRange === 'custom') {
        statsData = await callLogService.getStatsByRange(activeTimeRange, customRange);
      } else {
        statsData = await callLogService.getStatsByRange(activeTimeRange);
      }
      
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Silent refresh failed:', err);
      // Don't show error for silent refresh to avoid disrupting user experience
    }
  }, [activeTimeRange, customRange]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((newRange: TimeRange) => {
    setActiveTimeRange(newRange);
    
    // If switching to custom range, just set it as active - don't fetch data yet
    if (newRange === 'custom') {
      // Just set the range as active, user will select dates manually
      // Don't fetch data until dates are selected
      return;
    } else {
      // For non-custom ranges, fetch data immediately
      fetchStats(newRange);
    }
  }, []);

  // Handle custom range change
  const handleCustomRangeChange = useCallback((newRange: { start: Date; end: Date }) => {
    setCustomRange(newRange);
    
    // Fetch data immediately when custom range dates are changed
    if (activeTimeRange === 'custom' && newRange.start && newRange.end && newRange.start <= newRange.end) {
      fetchStats('custom', newRange);
    }
  }, [activeTimeRange]);

  useEffect(() => {
    // Initial load
    fetchStats();
  }, []);

  return (
    <div className="w-full p-4 lg:p-6 space-y-6">
      {/* Time Range Selector */}
      <TimeRangeSelector
        activeRange={activeTimeRange}
        onRangeChange={handleTimeRangeChange}
        customRange={customRange}
        onCustomRangeChange={handleCustomRangeChange}
        disabled={loading}
      />

      {/* Main Statistics */}
      <UnifiedStatistics
        period={activeTimeRange}
        stats={stats}
        loading={loading}
        error={error}
        onRefresh={silentRefresh}
      />
    </div>
  );
};

export default Dashboard;