import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface StatusTooltipProps {
  status: 'connected' | 'reconnecting' | 'checking' | 'disconnected';
  health: 'good' | 'poor' | 'stale';
  children: React.ReactNode;
}

export const StatusTooltip: React.FC<StatusTooltipProps> = ({ 
  status, 
  health, 
  children 
}) => {
  // Centralized tooltip content logic
  const getTooltipContent = (status: string, health: string): string => {
    if (status === 'connected') {
      return health === 'good'
        ? 'Connected - Good Connection'
        : health === 'poor'
        ? 'Connected - Poor Connection'
        : 'Connected - Stale Connection';
    } else if (status === 'reconnecting') {
      return 'Reconnecting...';
    } else if (status === 'checking') {
      return 'Checking Connection...';
    } else {
      return 'Disconnected';
    }
  };

  // Centralized color logic for tooltip background and border
  const getColorClasses = (status: string, health: string): string => {
    if (status === 'connected') {
      return health === 'good'
        ? 'bg-green-500/90 border-green-500'
        : health === 'poor'
        ? 'bg-yellow-500/90 border-yellow-500'
        : 'bg-orange-500/90 border-orange-500';
    } else if (status === 'reconnecting') {
      return 'bg-blue-500/90 border-blue-500';
    } else if (status === 'checking') {
      return 'bg-gray-500/90 border-gray-500';
    } else {
      return 'bg-red-500/90 border-red-500';
    }
  };

  // Centralized arrow color logic
  const getArrowColor = (status: string, health: string): string => {
    if (status === 'connected') {
      return health === 'good'
        ? 'fill-green-500'
        : health === 'poor'
        ? 'fill-yellow-500'
        : 'fill-orange-500';
    } else if (status === 'reconnecting') {
      return 'fill-blue-500';
    } else if (status === 'checking') {
      return 'fill-gray-500';
    } else {
      return 'fill-red-500';
    }
  };

  return (
    <Tooltip.Root delayDuration={200}> {/* Faster trigger time - 200ms instead of default 700ms */}
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={`px-3 py-2 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm border pointer-events-none z-50 ${getColorClasses(status, health)}`}
          sideOffset={8}
          side="top"
        >
          {getTooltipContent(status, health)}
          <Tooltip.Arrow className={getArrowColor(status, health)} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export default StatusTooltip;