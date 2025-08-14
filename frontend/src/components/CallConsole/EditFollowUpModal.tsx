import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { X, Save, Calendar } from 'lucide-react';
import type { FollowUpType, FollowUpPriority } from '../../types/followUp';
import { FOLLOW_UP_TYPES, FOLLOW_UP_PRIORITIES } from '../../types/followUp';

interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    total: string;
  }>;
}

interface FollowUp {
  id: number;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  scheduled_date: string;
  status: string;
  outcome?: string;
  woocommerce_order_id?: number;
}

interface EditFollowUpModalProps {
  followUp: FollowUp;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, data: {
    title?: string;
    description?: string;
    priority?: FollowUpPriority;
    scheduled_date?: string;
    outcome?: string;
    woocommerce_order_id?: number | null;
  }) => void;
  loading?: boolean;
  customerOrders?: WooCommerceOrder[];
  currentOrder?: WooCommerceOrder | null;
}

const EditFollowUpModal: React.FC<EditFollowUpModalProps> = ({
  followUp,
  isOpen,
  onClose,
  onSave,
  loading = false,
  customerOrders = [],
  currentOrder
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as FollowUpPriority,
    scheduled_date: '',
    scheduled_time: '09:00',
    outcome: '',
    woocommerce_order_id: null as number | null
  });

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && followUp) {
      const datetime = followUp.scheduled_date || '';
      const datePart = datetime.includes('T') ? datetime.split('T')[0] : datetime;
      const timePart = datetime.includes('T') ? datetime.split('T')[1].substring(0, 5) : '09:00';
      
      setFormData({
        title: followUp.title || '',
        description: followUp.description || '',
        priority: followUp.priority || 'medium',
        scheduled_date: datePart,
        scheduled_time: timePart,
        outcome: followUp.outcome || '',
        woocommerce_order_id: followUp.woocommerce_order_id || null
      });
    }
  }, [isOpen, followUp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const updateData: any = {};
    
    // Only include changed fields
    if (formData.title !== followUp.title) updateData.title = formData.title;
    if (formData.description !== (followUp.description || '')) updateData.description = formData.description;
    if (formData.priority !== followUp.priority) updateData.priority = formData.priority;
    
    // Handle datetime comparison and formatting
    const originalDateTime = followUp.scheduled_date || '';
    const originalDatePart = originalDateTime.includes('T') ? originalDateTime.split('T')[0] : originalDateTime;
    const originalTimePart = originalDateTime.includes('T') ? originalDateTime.split('T')[1].substring(0, 5) : '09:00';
    
    if (formData.scheduled_date !== originalDatePart || formData.scheduled_time !== originalTimePart) {
      updateData.scheduled_date = `${formData.scheduled_date}T${formData.scheduled_time}:00`;
    }
    
    if (formData.outcome !== (followUp.outcome || '')) updateData.outcome = formData.outcome;
    
    if (formData.woocommerce_order_id !== (followUp.woocommerce_order_id || null)) {
      updateData.woocommerce_order_id = formData.woocommerce_order_id;
    }

    if (Object.keys(updateData).length === 0) {
      toast.info('No changes to save');
      onClose();
      return;
    }

    onSave(followUp.id, updateData);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Follow-up
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {followUp.type.replace('_', ' ')} • {followUp.status}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Follow-up title"
                autoFocus
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as FollowUpPriority }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {FOLLOW_UP_PRIORITIES.map((priority: any) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Selection */}
            {customerOrders.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Related Order (Optional)
                  {currentOrder && formData.woocommerce_order_id === currentOrder.id && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                      • Current Order
                    </span>
                  )}
                </label>
                <select
                  value={formData.woocommerce_order_id || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    woocommerce_order_id: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No specific order</option>
                  {customerOrders.slice(0, 5).map((order) => (
                    <option key={order.id} value={order.id}>
                      Order #{order.id} - ৳{order.total} ({order.status})
                      {order.id === currentOrder?.id ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
                {formData.woocommerce_order_id && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This follow-up will be linked to Order #{formData.woocommerce_order_id}
                  </p>
                )}
                {followUp.woocommerce_order_id && formData.woocommerce_order_id !== followUp.woocommerce_order_id && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Changing from Order #{followUp.woocommerce_order_id}
                  </p>
                )}
              </div>
            )}

            {/* Scheduled Date & Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Scheduled Date & Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    setFormData(prev => ({ 
                      ...prev, 
                      scheduled_date: tomorrow.toISOString().split('T')[0], 
                      scheduled_time: '09:00' 
                    }));
                  }}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Tomorrow 9AM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    today.setHours(today.getHours() + 1);
                    setFormData(prev => ({ 
                      ...prev, 
                      scheduled_date: today.toISOString().split('T')[0], 
                      scheduled_time: today.toTimeString().substring(0, 5) 
                    }));
                  }}
                  className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  In 1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    setFormData(prev => ({ 
                      ...prev, 
                      scheduled_date: nextWeek.toISOString().split('T')[0], 
                      scheduled_time: '09:00' 
                    }));
                  }}
                  className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  Next Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setFormData(prev => ({ 
                      ...prev, 
                      scheduled_date: now.toISOString().split('T')[0], 
                      scheduled_time: now.toTimeString().substring(0, 5) 
                    }));
                  }}
                  className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                >
                  Now
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="Follow-up description"
              />
            </div>

            {/* Outcome (for completed follow-ups) */}
            {followUp.status === 'completed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Outcome
                </label>
                <textarea
                  value={formData.outcome}
                  onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={2}
                  placeholder="What was the outcome of this follow-up?"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Press Ctrl+Enter to save • Esc to cancel
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFollowUpModal; 