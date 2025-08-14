import React from 'react';
import { FOLLOW_UP_PRIORITIES } from '../../types/followUp';
import type { FollowUpPriority } from '../../types/followUp';

interface FollowUpPriorityBadgeProps {
  priority: FollowUpPriority;
  className?: string;
}

const FollowUpPriorityBadge: React.FC<FollowUpPriorityBadgeProps> = ({ priority, className = '' }) => {
  const priorityConfig = FOLLOW_UP_PRIORITIES.find(p => p.value === priority);
  
  if (!priorityConfig) {
    return null;
  }

  const getPriorityStyles = (priority: FollowUpPriority) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-600';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-600';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-600';
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-600';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getPriorityIcon = (priority: FollowUpPriority) => {
    switch (priority) {
      case 'low':
        return '↓';
      case 'medium':
        return '→';
      case 'high':
        return '↑';
      case 'urgent':
        return '⚡';
      default:
        return '';
    }
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityStyles(priority)} ${className}`}
    >
      <span className="mr-1">{getPriorityIcon(priority)}</span>
      {priorityConfig.label}
    </span>
  );
};

export default FollowUpPriorityBadge;
