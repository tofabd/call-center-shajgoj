import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { X, CheckCircle, Star, AlertTriangle, ArrowRight, Plus } from 'lucide-react';

interface FollowUp {
  id: number;
  title: string;
  description?: string;
  type: string;
  priority: string;
  woocommerce_order_id?: number;
  customer_name?: string;
}

interface CompleteFollowUpModalProps {
  followUp: FollowUp;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    outcome: string;
    customer_response: string;
    satisfaction_rating?: number;
    next_actions?: string[];
    additional_notes?: string;
  }) => void;
  loading?: boolean;
}

const CompleteFollowUpModal: React.FC<CompleteFollowUpModalProps> = ({
  followUp,
  isOpen,
  onClose,
  onComplete,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    outcome: '',
    customer_response: '',
    satisfaction_rating: 0,
    next_actions: [] as string[],
    additional_notes: '',
    create_followup: false,
    update_order_status: false
  });

  // Context-aware outcome options based on follow-up type
  const getOutcomeOptions = () => {
    switch (followUp.type) {
      case 'order_followup':
        return [
          { value: 'delivered_successfully', label: 'Order Delivered Successfully', color: 'text-green-600' },
          { value: 'delivery_delayed', label: 'Delivery Delayed', color: 'text-yellow-600' },
          { value: 'delivery_issue', label: 'Delivery Issue', color: 'text-red-600' },
          { value: 'customer_satisfied', label: 'Customer Satisfied with Order', color: 'text-green-600' },
          { value: 'issue_resolved', label: 'Order Issue Resolved', color: 'text-blue-600' },
          { value: 'escalated', label: 'Escalated to Manager', color: 'text-purple-600' }
        ];
      case 'sales_call':
        return [
          { value: 'interested', label: 'Customer Interested', color: 'text-green-600' },
          { value: 'not_interested', label: 'Not Interested', color: 'text-red-600' },
          { value: 'needs_more_info', label: 'Needs More Information', color: 'text-yellow-600' },
          { value: 'closed_sale', label: 'Sale Closed', color: 'text-green-600' },
          { value: 'demo_scheduled', label: 'Demo Scheduled', color: 'text-blue-600' },
          { value: 'quote_requested', label: 'Quote Requested', color: 'text-purple-600' }
        ];
      case 'payment_reminder':
        return [
          { value: 'payment_completed', label: 'Payment Completed', color: 'text-green-600' },
          { value: 'payment_scheduled', label: 'Payment Scheduled', color: 'text-blue-600' },
          { value: 'payment_issue', label: 'Payment Issue', color: 'text-red-600' },
          { value: 'extension_requested', label: 'Extension Requested', color: 'text-yellow-600' },
          { value: 'dispute_raised', label: 'Payment Dispute', color: 'text-red-600' }
        ];
      case 'delivery_check':
        return [
          { value: 'delivered_confirmed', label: 'Delivery Confirmed', color: 'text-green-600' },
          { value: 'not_delivered', label: 'Not Delivered Yet', color: 'text-yellow-600' },
          { value: 'delivery_damaged', label: 'Delivered Damaged', color: 'text-red-600' },
          { value: 'customer_happy', label: 'Customer Very Satisfied', color: 'text-green-600' },
          { value: 'return_requested', label: 'Return Requested', color: 'text-purple-600' }
        ];
      case 'complaint_resolution':
        return [
          { value: 'complaint_resolved', label: 'Complaint Resolved', color: 'text-green-600' },
          { value: 'partial_resolution', label: 'Partial Resolution', color: 'text-yellow-600' },
          { value: 'escalation_needed', label: 'Needs Escalation', color: 'text-red-600' },
          { value: 'customer_satisfied', label: 'Customer Satisfied', color: 'text-green-600' },
          { value: 'compensation_provided', label: 'Compensation Provided', color: 'text-blue-600' }
        ];
      default:
        return [
          { value: 'contacted_successfully', label: 'Successfully Contacted', color: 'text-green-600' },
          { value: 'left_message', label: 'Left Message', color: 'text-blue-600' },
          { value: 'customer_busy', label: 'Customer Busy', color: 'text-yellow-600' },
          { value: 'no_answer', label: 'No Answer', color: 'text-gray-600' },
          { value: 'issue_resolved', label: 'Issue Resolved', color: 'text-green-600' },
          { value: 'rescheduled', label: 'Rescheduled', color: 'text-purple-600' }
        ];
    }
  };

  const getResponseOptions = () => [
    'Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative', 'No Response'
  ];

  const getNextActionOptions = () => {
    const baseActions = [
      'Send follow-up email',
      'Schedule another call',
      'Send product information',
      'Escalate to manager',
      'Update order status',
      'Create support ticket'
    ];

    const typeSpecificActions = {
      order_followup: ['Track delivery', 'Process return', 'Send shipping update'],
      sales_call: ['Send quote', 'Schedule demo', 'Send case studies'],
      payment_reminder: ['Set up payment plan', 'Send invoice', 'Process refund'],
      delivery_check: ['Arrange redelivery', 'Process replacement', 'Collect feedback'],
      complaint_resolution: ['Provide compensation', 'Escalate complaint', 'Schedule manager call']
    };

    return [...baseActions, ...(typeSpecificActions[followUp.type as keyof typeof typeSpecificActions] || [])];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.outcome) {
      toast.error('Please select an outcome');
      return;
    }

    onComplete({
      outcome: formData.outcome,
      customer_response: formData.customer_response,
      satisfaction_rating: formData.satisfaction_rating > 0 ? formData.satisfaction_rating : undefined,
      next_actions: formData.next_actions.length > 0 ? formData.next_actions : undefined,
      additional_notes: formData.additional_notes || undefined
    });
  };

  const handleNextActionToggle = (action: string) => {
    setFormData(prev => ({
      ...prev,
      next_actions: prev.next_actions.includes(action)
        ? prev.next_actions.filter(a => a !== action)
        : [...prev.next_actions, action]
    }));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const outcomeOptions = getOutcomeOptions();
  const selectedOutcome = outcomeOptions.find(opt => opt.value === formData.outcome);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Complete Follow-up
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {followUp.title}
                {followUp.woocommerce_order_id && (
                  <span className="ml-2 text-blue-600">• Order #{followUp.woocommerce_order_id}</span>
                )}
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Outcome Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                What was the outcome of this follow-up? *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {outcomeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, outcome: option.value }))}
                    className={`p-3 text-left border rounded-lg transition-all ${
                      formData.outcome === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className={`text-sm font-medium ${option.color}`}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Response */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How did the customer respond?
              </label>
              <select
                value={formData.customer_response}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_response: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select customer response</option>
                {getResponseOptions().map((response) => (
                  <option key={response} value={response}>
                    {response}
                  </option>
                ))}
              </select>
            </div>

            {/* Satisfaction Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Customer Satisfaction (Optional)
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, satisfaction_rating: star }))}
                    className={`p-1 rounded transition-colors ${
                      star <= formData.satisfaction_rating
                        ? 'text-yellow-500'
                        : 'text-gray-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star className={`w-6 h-6 ${star <= formData.satisfaction_rating ? 'fill-current' : ''}`} />
                  </button>
                ))}
                {formData.satisfaction_rating > 0 && (
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {formData.satisfaction_rating}/5 stars
                  </span>
                )}
              </div>
            </div>

            {/* Next Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Next Actions Needed (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getNextActionOptions().map((action) => (
                  <label
                    key={action}
                    className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.next_actions.includes(action)}
                      onChange={() => handleNextActionToggle(action)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="Any additional details about this follow-up..."
              />
            </div>

            {/* Quick Actions */}
            {(followUp.type === 'order_followup' || followUp.woocommerce_order_id) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.create_followup}
                      onChange={(e) => setFormData(prev => ({ ...prev, create_followup: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-800 dark:text-blue-200">Create follow-up follow-up</span>
                  </label>
                  {followUp.woocommerce_order_id && (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.update_order_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, update_order_status: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-blue-800 dark:text-blue-200">Update order status</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.outcome}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Completing...' : 'Complete Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteFollowUpModal; 