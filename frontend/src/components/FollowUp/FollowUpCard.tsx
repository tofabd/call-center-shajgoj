import React from 'react';
import { Clock, User, Phone, Mail, Calendar, Eye, Edit, Trash2, CheckCircle } from 'lucide-react';
import type { CustomerFollowUp } from '../../types/followUp';
import { formatFollowUpDate } from '../../services/followUpService';
import FollowUpStatusBadge from './FollowUpStatusBadge';
import FollowUpPriorityBadge from './FollowUpPriorityBadge';

interface FollowUpCardProps {
  followUp: CustomerFollowUp;
  onView?: (followUp: CustomerFollowUp) => void;
  onEdit?: (followUp: CustomerFollowUp) => void;
  onDelete?: (followUp: CustomerFollowUp) => void;
  onComplete?: (followUp: CustomerFollowUp) => void;
  onCall?: (phoneNumber: string) => void;
  className?: string;
}

const FollowUpCard: React.FC<FollowUpCardProps> = ({
  followUp,
  onView,
  onEdit,
  onDelete,
  onComplete,
  onCall,
  className = ''
}) => {
  const isOverdue = followUp.status === 'pending' && new Date(followUp.scheduled_date) < new Date();
  const isDueToday = followUp.status === 'pending' && 
    new Date(followUp.scheduled_date).toDateString() === new Date().toDateString();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {followUp.title}
          </h3>
          {followUp.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {followUp.description}
            </p>
          )}
        </div>
        
        {/* Status indicators */}
        <div className="flex flex-col items-end space-y-2 ml-4">
          {isOverdue && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              <Clock className="w-3 h-3 mr-1" />
              Overdue
            </span>
          )}
          {isDueToday && !isOverdue && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
              <Calendar className="w-3 h-3 mr-1" />
              Due Today
            </span>
          )}
        </div>
      </div>

      {/* Customer Info */}
      {(followUp.customer_name || followUp.customer_phone || followUp.customer_email) && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Customer</h4>
          <div className="space-y-2">
            {followUp.customer_name && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <User className="w-4 h-4 mr-2" />
                {followUp.customer_name}
              </div>
            )}
            {followUp.customer_phone && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4 mr-2" />
                <span 
                  className={`${onCall ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                  onClick={() => onCall && onCall(followUp.customer_phone!)}
                >
                  {followUp.customer_phone}
                </span>
              </div>
            )}
            {followUp.customer_email && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4 mr-2" />
                <a 
                  href={`mailto:${followUp.customer_email}`}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {followUp.customer_email}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meta Information */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FollowUpStatusBadge status={followUp.status} />
            <FollowUpPriorityBadge priority={followUp.priority} />
          </div>
          
          {followUp.assignedUser && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <User className="w-4 h-4 mr-1" />
              {followUp.assignedUser.name}
            </div>
          )}
        </div>

        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <Calendar className="w-4 h-4 mr-2" />
          <span>Scheduled: {formatFollowUpDate(followUp.scheduled_date)}</span>
        </div>

        {followUp.completed_date && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span>Completed: {formatFollowUpDate(followUp.completed_date)}</span>
          </div>
        )}

        {followUp.outcome && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mt-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Outcome:</strong> {followUp.outcome}
            </p>
          </div>
        )}

        {followUp.tags && followUp.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {followUp.tags.map((tag, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onView && (
          <button
            onClick={() => onView(followUp)}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        
        {onEdit && followUp.status !== 'completed' && (
          <button
            onClick={() => onEdit(followUp)}
            className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/20 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        
        {onComplete && followUp.status === 'pending' && (
          <button
            onClick={() => onComplete(followUp)}
            className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/20 transition-colors"
            title="Mark Complete"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
        
        {onDelete && (
          <button
            onClick={() => onDelete(followUp)}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FollowUpCard;
