import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  MessageSquare,
  Package,
  CreditCard,
  Truck,
  TrendingUp,
  AlertTriangle,
  Users,
  Trash2,
  Edit3
} from 'lucide-react';
import { 
  getCustomerFollowUpsByPhone, 
  createQuickFollowUp, 
  markFollowUpCompleted,
  deleteFollowUp,
  updateFollowUpQuick,
  undoCompleteFollowUp,
  formatFollowUpDate,
  getPriorityColor
} from '@services/followUpService';
import EditFollowUpModal from './EditFollowUpModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import UndoToast from './UndoToast';
import CompleteFollowUpModal from './CompleteFollowUpModal';
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

interface FollowUpPanelProps {
  selectedPhoneNumber: string | null;
  customerName?: string;
  customerEmail?: string;
  woocommerce_customer_id?: number;
  currentOrder?: WooCommerceOrder | null;
  customerOrders?: WooCommerceOrder[];
}

const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ 
  selectedPhoneNumber, 
  customerName, 
  customerEmail,
  woocommerce_customer_id,
  currentOrder,
  customerOrders = []
}) => {
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState({
    title: '',
    type: 'general_check_in' as FollowUpType,
    priority: 'medium' as FollowUpPriority,
    description: '',
    scheduled_date: '',
    scheduled_time: '09:00',
    woocommerce_order_id: null as number | null
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFollowUpForEdit, setSelectedFollowUpForEdit] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFollowUpForDelete, setSelectedFollowUpForDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<{
    followUpId: number;
    timeoutId: NodeJS.Timeout;
  } | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedFollowUpForComplete, setSelectedFollowUpForComplete] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const queryClient = useQueryClient();

  // Enhanced quick follow-up templates with smart scheduling
  const quickTemplates = [
    {
      title: 'Call back - customer missed call',
      type: 'general_check_in' as FollowUpType,
      priority: 'medium' as FollowUpPriority,
      description: 'Customer didn\'t answer, follow up when convenient',
      defaultSchedule: 'in2hours'
    },
    {
      title: 'Send product information',
      type: 'sales_call' as FollowUpType,
      priority: 'high' as FollowUpPriority,
      description: 'Send detailed product specs, pricing, and availability',
      defaultSchedule: 'tomorrow9am'
    },
    {
      title: 'Quote follow-up',
      type: 'sales_call' as FollowUpType,
      priority: 'high' as FollowUpPriority,
      description: 'Follow up on quote sent, answer questions',
      defaultSchedule: 'in3days'
    },
    {
      title: 'Payment reminder',
      type: 'payment_reminder' as FollowUpType,
      priority: 'urgent' as FollowUpPriority,
      description: 'Gentle reminder about pending payment',
      defaultSchedule: 'in1hour'
    },
    {
      title: 'Order status update',
      type: 'order_followup' as FollowUpType,
      priority: 'medium' as FollowUpPriority,
      description: 'Update customer on order progress and timeline',
      defaultSchedule: 'tomorrow2pm',
      orderRequired: true
    },
    {
      title: 'Delivery confirmation',
      type: 'delivery_check' as FollowUpType,
      priority: 'medium' as FollowUpPriority,
      description: 'Confirm delivery received and customer satisfaction',
      defaultSchedule: 'nextday10am',
      orderRequired: true
    },
    {
      title: 'Demo scheduling',
      type: 'sales_call' as FollowUpType,
      priority: 'high' as FollowUpPriority,
      description: 'Schedule product demo at customer\'s convenience',
      defaultSchedule: 'nextweek'
    },
    {
      title: 'Complaint resolution',
      type: 'complaint_resolution' as FollowUpType,
      priority: 'urgent' as FollowUpPriority,
      description: 'Follow up on complaint resolution and ensure satisfaction',
      defaultSchedule: 'sameday'
    },
    {
      title: 'Upsell opportunity',
      type: 'upsell_opportunity' as FollowUpType,
      priority: 'medium' as FollowUpPriority,
      description: 'Present complementary products based on purchase history',
      defaultSchedule: 'in1week'
    }
  ];

  // Fetch customer follow-ups
  const followUpsQuery = useQuery({
    queryKey: ['customerFollowUps', selectedPhoneNumber],
    queryFn: () => getCustomerFollowUpsByPhone(selectedPhoneNumber!),
    enabled: !!selectedPhoneNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Cleanup effect for undo timeout
  React.useEffect(() => {
    return () => {
      if (recentlyCompleted) {
        clearTimeout(recentlyCompleted.timeoutId);
      }
    };
  }, [recentlyCompleted]);

  const handleQuickCreate = async () => {
    if (!selectedPhoneNumber || !quickCreateData.title.trim()) {
      toast.error('Please provide a title for the follow-up');
      return;
    }

    setIsCreating(true);
    try {
      // Prepare the scheduled date - use the full datetime if provided, otherwise default to tomorrow
      const scheduledDate = quickCreateData.scheduled_date || 
        `${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T${quickCreateData.scheduled_time}`;

      await createQuickFollowUp({
        title: quickCreateData.title,
        type: quickCreateData.type,
        priority: quickCreateData.priority,
        description: quickCreateData.description,
        scheduled_date: scheduledDate,
        customer_phone: selectedPhoneNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        woocommerce_customer_id: woocommerce_customer_id,
        woocommerce_order_id: quickCreateData.woocommerce_order_id,
      });

      toast.success('Follow-up created successfully');
      setShowQuickCreate(false);
      setQuickCreateData({
        title: '',
        type: 'general_check_in',
        priority: 'medium',
        description: '',
        scheduled_date: '',
        scheduled_time: '09:00',
        woocommerce_order_id: null
      });
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
    } catch (error) {
      toast.error('Failed to create follow-up');
      console.error('Error creating follow-up:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Helper function to calculate datetime from schedule shortcuts
  const getScheduledDateTime = (schedule: string) => {
    const now = new Date();
    let targetDate = new Date();
    let time = '09:00';

    switch (schedule) {
      case 'in1hour':
        targetDate.setHours(now.getHours() + 1);
        time = targetDate.toTimeString().substring(0, 5);
        break;
      case 'in2hours':
        targetDate.setHours(now.getHours() + 2);
        time = targetDate.toTimeString().substring(0, 5);
        break;
      case 'sameday':
        targetDate = new Date();
        targetDate.setHours(now.getHours() + 1);
        time = targetDate.toTimeString().substring(0, 5);
        break;
      case 'tomorrow9am':
        targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        time = '09:00';
        break;
      case 'tomorrow2pm':
        targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        time = '14:00';
        break;
      case 'nextday10am':
        targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        time = '10:00';
        break;
      case 'in3days':
        targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        time = '09:00';
        break;
      case 'in1week':
        targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        time = '09:00';
        break;
      case 'nextweek':
        targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        time = '09:00';
        break;
      default:
        // Default to tomorrow 9 AM
        targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        time = '09:00';
    }

    return {
      date: targetDate.toISOString().split('T')[0],
      time: time,
      datetime: `${targetDate.toISOString().split('T')[0]}T${time}`
    };
  };

  const handleQuickTemplate = (template: typeof quickTemplates[0]) => {
    const schedule = getScheduledDateTime(template.defaultSchedule || 'tomorrow9am');
    
    setQuickCreateData({
      title: template.title,
      type: template.type,
      priority: template.priority,
      description: template.description,
      scheduled_date: schedule.datetime,
      scheduled_time: schedule.time,
      woocommerce_order_id: currentOrder?.id || null // Auto-select only if order is explicitly selected
    });
    setShowQuickCreate(true);
  };

  const handleOpenQuickCreate = () => {
    // Initialize with auto-selection only if an order is explicitly selected
    setQuickCreateData({
      title: '',
      type: 'general_check_in',
      priority: 'medium',
      description: '',
      scheduled_date: '',
      scheduled_time: '09:00',
      woocommerce_order_id: currentOrder?.id || null // Auto-select only if order is explicitly selected
    });
    setShowQuickCreate(true);
  };

  const handleEditFollowUp = (followUp: any) => {
    setSelectedFollowUpForEdit(followUp);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (id: number, data: any) => {
    setIsEditing(true);
    try {
      await updateFollowUpQuick(id, data);
      toast.success('Follow-up updated successfully');
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
      setShowEditModal(false);
      setSelectedFollowUpForEdit(null);
    } catch (error) {
      toast.error('Failed to update follow-up');
    } finally {
      setIsEditing(false);
    }
  };

  const handleCompleteFollowUp = (followUp: any) => {
    // For simple follow-ups, allow quick completion with undo
    if (followUp.type === 'general_check_in' && !followUp.woocommerce_order_id) {
      handleQuickComplete(followUp.id);
    } else {
      // For complex follow-ups, show completion modal
      setSelectedFollowUpForComplete(followUp);
      setShowCompleteModal(true);
    }
  };

  const handleQuickComplete = async (followUpId: number) => {
    try {
      await markFollowUpCompleted(followUpId);
      
      // Clear any existing timeout
      if (recentlyCompleted) {
        clearTimeout(recentlyCompleted.timeoutId);
      }

      // Set up undo timeout
      const timeoutId = setTimeout(() => {
        setRecentlyCompleted(null);
      }, 5000);

      setRecentlyCompleted({ followUpId, timeoutId });

      // Show undo toast
      toast.success(
        <UndoToast 
          message="Follow-up completed"
          onUndo={() => handleUndoComplete(followUpId)}
        />,
        { 
          autoClose: 5000,
          style: {
            background: '#10B981',
            color: 'white',
          }
        }
      );
      
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
    } catch (error) {
      toast.error('Failed to complete follow-up');
    }
  };

  const handleCompleteWithOutcome = async (data: any) => {
    if (!selectedFollowUpForComplete) return;

    setIsCompleting(true);
    try {
      await markFollowUpCompleted(selectedFollowUpForComplete.id, data);
      toast.success('Follow-up completed with outcome recorded');
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
      setShowCompleteModal(false);
      setSelectedFollowUpForComplete(null);
    } catch (error) {
      toast.error('Failed to complete follow-up');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleUndoComplete = async (followUpId: number) => {
    try {
      await undoCompleteFollowUp(followUpId);
      toast.success('Follow-up reopened');
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
      
      // Clear the undo timeout
      if (recentlyCompleted) {
        clearTimeout(recentlyCompleted.timeoutId);
        setRecentlyCompleted(null);
      }
    } catch (error) {
      toast.error('Failed to undo completion');
    }
  };

  const handleDeleteFollowUp = (followUp: any) => {
    setSelectedFollowUpForDelete(followUp);
    setShowDeleteModal(true);
  };

  const confirmDeleteFollowUp = async () => {
    if (!selectedFollowUpForDelete) return;

    setIsDeleting(true);
    try {
      await deleteFollowUp(selectedFollowUpForDelete.id);
      toast.success('Follow-up deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['customerFollowUps', selectedPhoneNumber] });
      setShowDeleteModal(false);
      setSelectedFollowUpForDelete(null);
    } catch (error) {
      toast.error('Failed to delete follow-up');
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeIcon = (type: FollowUpType) => {
    const iconMap: Record<FollowUpType, React.ComponentType<any>> = {
      sales_call: Phone,
      order_followup: Package,
      payment_reminder: CreditCard,
      delivery_check: Truck,
      feedback_request: MessageSquare,
      upsell_opportunity: TrendingUp,
      complaint_resolution: AlertTriangle,
      general_check_in: Users,
    };
    return iconMap[type] || Users;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!selectedPhoneNumber) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Select a customer to view follow-ups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Follow-ups</h3>
            {followUpsQuery.data && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                {followUpsQuery.data.length}
              </span>
            )}
          </div>
          <button
            onClick={handleOpenQuickCreate}
            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Create Quick Follow-up"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Quick Template Buttons */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Quick Templates:</p>
          <div className="space-y-2">
            {/* Most Common Templates */}
            <div className="flex flex-wrap gap-1">
              {quickTemplates
                .filter(template => !template.orderRequired || customerOrders.length > 0)
                .slice(0, 4)
                .map((template, index) => {
                const schedule = getScheduledDateTime(template.defaultSchedule || 'tomorrow9am');
                const timeHint = template.defaultSchedule?.includes('hour') ? 'urgent' : 
                               template.defaultSchedule?.includes('tomorrow') ? 'tomorrow' :
                               template.defaultSchedule?.includes('week') ? 'next week' : 'scheduled';
                
                const priorityColors = {
                  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50',
                  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50',
                  medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50',
                  low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                };
                
                return (
                  <button
                    key={index}
                    onClick={() => handleQuickTemplate(template)}
                    className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${priorityColors[template.priority]}`}
                    title={`${template.description} (${timeHint})`}
                  >
                    <span>{template.title}</span>
                    <span className="text-xs opacity-60">({timeHint})</span>
                  </button>
                );
              })}
            </div>
            
            {/* Show More Button */}
            {quickTemplates.filter(template => !template.orderRequired || customerOrders.length > 0).length > 4 && (
              <details className="group">
                <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  + {quickTemplates.filter(template => !template.orderRequired || customerOrders.length > 0).length - 4} more templates
                </summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {quickTemplates
                    .filter(template => !template.orderRequired || customerOrders.length > 0)
                    .slice(4)
                    .map((template, index) => {
                    const schedule = getScheduledDateTime(template.defaultSchedule || 'tomorrow9am');
                    const timeHint = template.defaultSchedule?.includes('hour') ? 'urgent' : 
                                   template.defaultSchedule?.includes('tomorrow') ? 'tomorrow' :
                                   template.defaultSchedule?.includes('week') ? 'next week' : 'scheduled';
                    
                    const priorityColors = {
                      urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50',
                      high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50',
                      medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50',
                      low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    };
                    
                    return (
                      <button
                        key={index + 4}
                        onClick={() => handleQuickTemplate(template)}
                        className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${priorityColors[template.priority]}`}
                        title={`${template.description} (${timeHint})`}
                      >
                        <span>{template.title}</span>
                        <span className="text-xs opacity-60">({timeHint})</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        </div>

        {followUpsQuery.isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading follow-ups...</p>
          </div>
        ) : followUpsQuery.error ? (
          <div className="text-center py-4 text-red-500">
            <p className="text-sm">Failed to load follow-ups</p>
          </div>
        ) : followUpsQuery.data?.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No follow-ups found</p>
            <button
              onClick={handleOpenQuickCreate}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Create your first follow-up
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {followUpsQuery.data?.map((followUp) => {
              const TypeIcon = getTypeIcon(followUp.type);
              return (
                <div
                  key={followUp.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <TypeIcon className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {followUp.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getPriorityColor(followUp.priority)}20`,
                            color: getPriorityColor(followUp.priority)
                          }}
                        >
                          {followUp.priority}
                        </span>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(followUp.status)}
                          <span className="capitalize">{followUp.status.replace('_', ' ')}</span>
                        </span>
                      </div>
                      
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatFollowUpDate(followUp.scheduled_date)}</span>
                        </span>
                        {followUp.woocommerce_order_id && (
                          <div className="flex items-center space-x-1">
                            <Package className="w-3 h-3" />
                            <span>Order #{followUp.woocommerce_order_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {followUp.status === 'pending' && (
                        <button
                          onClick={() => handleCompleteFollowUp(followUp)}
                          className={`p-1 rounded transition-colors ${
                            followUp.type !== 'general_check_in' || followUp.woocommerce_order_id
                              ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-300'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                          title={
                            followUp.type !== 'general_check_in' || followUp.woocommerce_order_id
                              ? 'Complete with outcome'
                              : 'Quick complete'
                          }
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditFollowUp(followUp)}
                        className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Edit follow-up"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFollowUp(followUp)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete follow-up"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Create Modal */}
      {showQuickCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Follow-up
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={quickCreateData.title}
                    onChange={(e) => setQuickCreateData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Follow-up title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={quickCreateData.type}
                    onChange={(e) => setQuickCreateData(prev => ({ ...prev, type: e.target.value as FollowUpType }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {FOLLOW_UP_TYPES.map((type: any) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={quickCreateData.priority}
                    onChange={(e) => setQuickCreateData(prev => ({ ...prev, priority: e.target.value as FollowUpPriority }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {FOLLOW_UP_PRIORITIES.map((priority: any) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scheduled Date & Time
                    <span className="text-xs text-gray-500 ml-2">(defaults to tomorrow 9AM)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={quickCreateData.scheduled_date?.split('T')[0] || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      onChange={(e) => {
                        const time = quickCreateData.scheduled_time || '09:00';
                        const datetime = `${e.target.value}T${time}`;
                        setQuickCreateData(prev => ({ ...prev, scheduled_date: datetime }));
                      }}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="time"
                      value={quickCreateData.scheduled_time || '09:00'}
                      onChange={(e) => {
                        const date = quickCreateData.scheduled_date?.split('T')[0] || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        const datetime = `${date}T${e.target.value}`;
                        setQuickCreateData(prev => ({ ...prev, scheduled_date: datetime, scheduled_time: e.target.value }));
                      }}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        const datetime = `${tomorrow.toISOString().split('T')[0]}T09:00`;
                        setQuickCreateData(prev => ({ ...prev, scheduled_date: datetime, scheduled_time: '09:00' }));
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
                        const datetime = today.toISOString().slice(0, 16);
                        setQuickCreateData(prev => ({ ...prev, scheduled_date: datetime, scheduled_time: datetime.split('T')[1] }));
                      }}
                      className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      In 1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        const datetime = `${nextWeek.toISOString().split('T')[0]}T09:00`;
                        setQuickCreateData(prev => ({ ...prev, scheduled_date: datetime, scheduled_time: '09:00' }));
                      }}
                      className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      Next Week
                    </button>
                  </div>
                </div>
                
                {/* Order Selection */}
                {customerOrders.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Related Order (Optional)
                      {currentOrder && quickCreateData.woocommerce_order_id && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                          • Auto-selected: Order #{currentOrder.id}
                        </span>
                      )}
                    </label>
                    <select
                      value={quickCreateData.woocommerce_order_id || ''}
                      onChange={(e) => setQuickCreateData(prev => ({ 
                        ...prev, 
                        woocommerce_order_id: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">No specific order</option>
                      {customerOrders.slice(0, 5).map((order) => (
                        <option key={order.id} value={order.id}>
                          Order #{order.id} - ৳{order.total} ({order.status})
                          {currentOrder && order.id === currentOrder.id ? ' (Current)' : ''}
                        </option>
                      ))}
                    </select>
                    {quickCreateData.woocommerce_order_id && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        This follow-up will be linked to Order #{quickCreateData.woocommerce_order_id}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={quickCreateData.description}
                    onChange={(e) => setQuickCreateData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowQuickCreate(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickCreate}
                  disabled={isCreating || !quickCreateData.title.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedFollowUpForEdit && (
        <EditFollowUpModal
          followUp={selectedFollowUpForEdit}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedFollowUpForEdit(null);
          }}
          onSave={handleSaveEdit}
          loading={isEditing}
          customerOrders={customerOrders}
          currentOrder={currentOrder}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedFollowUpForDelete && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          title="Delete Follow-up"
          message={`Are you sure you want to delete "${selectedFollowUpForDelete.title}"?`}
          context={`Customer: ${customerName || 'Unknown'} • Created: ${new Date(selectedFollowUpForDelete.created_at).toLocaleDateString()}`}
          onConfirm={confirmDeleteFollowUp}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedFollowUpForDelete(null);
          }}
          loading={isDeleting}
        />
      )}

      {/* Complete Follow-up Modal */}
      {showCompleteModal && selectedFollowUpForComplete && (
        <CompleteFollowUpModal
          followUp={selectedFollowUpForComplete}
          isOpen={showCompleteModal}
          onClose={() => {
            setShowCompleteModal(false);
            setSelectedFollowUpForComplete(null);
          }}
          onComplete={handleCompleteWithOutcome}
          loading={isCompleting}
        />
      )}
    </div>
  );
};

export default FollowUpPanel; 