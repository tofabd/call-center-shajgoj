import React from 'react';
import { FOLLOW_UP_STATUSES } from '../../types/followUp';
import type { FollowUpStatus } from '../../types/followUp';

interface FollowUpStatusBadgeProps {
  status: FollowUpStatus;
  className?: string;
}

const FollowUpStatusBadge: React.FC<FollowUpStatusBadgeProps> = ({ status, className = '' }) => {
  const statusConfig = FOLLOW_UP_STATUSES.find(s => s.value === status);
  
  if (!statusConfig) {
    return null;
  }

  const getStatusStyles = (status: FollowUpStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-600';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-600';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
    }
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(status)} ${className}`}
    >
      {statusConfig.label}
    </span>
  );
};

export default FollowUpStatusBadge; 