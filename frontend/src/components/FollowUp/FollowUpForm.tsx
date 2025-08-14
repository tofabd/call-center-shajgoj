import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  Tag, 
  ShoppingCart, 
  Hash,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Package,
  CreditCard,
  Truck,
  MessageSquare,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import * as FollowUpTypes from '../../types/followUp';

interface FollowUpFormProps {
  initialValues?: Partial<FollowUpTypes.CreateFollowUpData>;
  onSubmit: (data: FollowUpTypes.CreateFollowUpData) => void;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
  users?: FollowUpTypes.User[];
}

const defaultForm: FollowUpTypes.CreateFollowUpData = {
  title: '',
  description: '',
  type: 'general_check_in',
  priority: 'medium',
  customer_phone: '',
  customer_email: '',
  customer_name: '',
  woocommerce_customer_id: undefined,
  woocommerce_order_id: undefined,
  scheduled_date: '',
  assigned_to: undefined,
  tags: [],
  metadata: {},
};

// Icon mapping for follow-up types
const typeIcons: Record<FollowUpTypes.FollowUpType, React.ReactNode> = {
  sales_call: <Phone className="w-4 h-4" />,
  order_followup: <Package className="w-4 h-4" />,
  payment_reminder: <CreditCard className="w-4 h-4" />,
  delivery_check: <Truck className="w-4 h-4" />,
  feedback_request: <MessageSquare className="w-4 h-4" />,
  upsell_opportunity: <TrendingUp className="w-4 h-4" />,
  complaint_resolution: <AlertTriangle className="w-4 h-4" />,
  general_check_in: <Users className="w-4 h-4" />,
};

const FollowUpForm: React.FC<FollowUpFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
  users = [],
}) => {
  const [form, setForm] = useState<FollowUpTypes.CreateFollowUpData>({ ...defaultForm, ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    // Remove timezone part and ensure proper format for datetime-local
    return dateString.slice(0, 16);
  };

  // Helper function to format initial values for form
  const formatInitialValues = (values: Partial<FollowUpTypes.CreateFollowUpData>) => {
    if (!values) return {};
    
    return {
      ...values,
      scheduled_date: values.scheduled_date ? formatDateForInput(values.scheduled_date) : '',
      tags: Array.isArray(values.tags) ? values.tags : [],
    };
  };

  useEffect(() => {
    if (initialValues) {
      const formattedValues = formatInitialValues(initialValues);
      setForm({ ...defaultForm, ...formattedValues });
    }
  }, [initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.type) newErrors.type = 'Type is required';
    if (!form.priority) newErrors.priority = 'Priority is required';
    if (!form.scheduled_date) {
      newErrors.scheduled_date = 'Scheduled date is required';
    } else {
      // Check if scheduled date is in the future
      const selectedDate = new Date(form.scheduled_date);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.scheduled_date = 'Scheduled date must be in the future';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    // Format the data for API submission
    const submitData = {
      ...form,
      // Convert datetime-local format to ISO string for backend
      scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : '',
      // Ensure tags is an array
      tags: Array.isArray(form.tags) ? form.tags : [],
      // Convert empty strings to undefined for optional fields
      customer_phone: form.customer_phone || undefined,
      customer_email: form.customer_email || undefined,
      customer_name: form.customer_name || undefined,
      woocommerce_customer_id: form.woocommerce_customer_id || undefined,
      woocommerce_order_id: form.woocommerce_order_id || undefined,
      assigned_to: form.assigned_to || undefined,
    };
    
    console.log('Submitting follow-up data:', submitData);
    onSubmit(submitData);
  };

  const getPriorityColor = (priority: FollowUpTypes.FollowUpPriority) => {
    const colors = {
      low: 'text-green-600 bg-green-50 border-green-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      urgent: 'text-red-600 bg-red-50 border-red-200',
    };
    return colors[priority];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
            Basic Information
          </h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                errors.title ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
              placeholder="Enter follow-up title..."
              disabled={loading}
            />
            {errors.title && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.title}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Enter follow-up description..."
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Type and Priority Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Tag className="w-5 h-5 mr-2 text-purple-600" />
            Classification
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none [&::-ms-expand]:hidden [&::-webkit-select-placeholder]:hidden ${
                  errors.type ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                style={{ backgroundImage: 'none' }}
                disabled={loading}
              >
                {FollowUpTypes.FOLLOW_UP_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="flex items-center">
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                {typeIcons[form.type]}
              </div>
            </div>
            {errors.type && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.type}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none [&::-ms-expand]:hidden [&::-webkit-select-placeholder]:hidden ${
                errors.priority ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
              style={{ backgroundImage: 'none' }}
              disabled={loading}
            >
              {FollowUpTypes.FOLLOW_UP_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} className="flex items-center">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(p.value)}`}>
                    {p.label}
                  </span>
                </option>
              ))}
            </select>
            {errors.priority && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.priority}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule and Assignment Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock className="w-5 h-5 mr-2 text-green-600" />
            Schedule & Assignment
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scheduled Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                name="scheduled_date"
                value={form.scheduled_date || ''}
                min={new Date().toISOString().slice(0, 16)}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                  errors.scheduled_date ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                disabled={loading}
              />
            </div>
            {errors.scheduled_date && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.scheduled_date}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Select a future date and time for the follow-up
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assigned To
            </label>
            <div className="relative">
              <select
                name="assigned_to"
                value={form.assigned_to || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none [&::-ms-expand]:hidden [&::-webkit-select-placeholder]:hidden bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                style={{ backgroundImage: 'none' }}
                disabled={loading}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Information Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <User className="w-5 h-5 mr-2 text-indigo-600" />
            Customer Information
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Name
            </label>
            <div className="relative">
              <input
                name="customer_name"
                value={form.customer_name || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter customer name..."
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Email
            </label>
            <div className="relative">
              <input
                name="customer_email"
                type="email"
                value={form.customer_email || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter customer email..."
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Phone
            </label>
            <div className="relative">
              <input
                name="customer_phone"
                value={form.customer_phone || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter customer phone..."
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Phone className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WooCommerce Integration Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-orange-600" />
            WooCommerce Integration
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer ID
            </label>
            <div className="relative">
              <input
                name="woocommerce_customer_id"
                type="number"
                value={form.woocommerce_customer_id || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter WooCommerce customer ID..."
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Hash className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order ID
            </label>
            <div className="relative">
              <input
                name="woocommerce_order_id"
                type="number"
                value={form.woocommerce_order_id || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter WooCommerce order ID..."
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Hash className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tags Section */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Tag className="w-5 h-5 mr-2 text-pink-600" />
            Tags & Organization
          </h3>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="relative">
            <input
              name="tags"
              value={form.tags?.join(', ') || ''}
              onChange={handleTagsChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Enter tags separated by commas..."
              disabled={loading}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Tag className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Separate multiple tags with commas (e.g., urgent, follow-up, customer)
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {isEdit ? 'Saving...' : 'Creating...'}
            </div>
          ) : (
            <div className="flex items-center">
              {isEdit ? 'Save Changes' : 'Create Follow-up'}
            </div>
          )}
        </button>
      </div>
    </form>
  );
};

export default FollowUpForm; 