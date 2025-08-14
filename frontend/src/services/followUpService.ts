import api from './api';
import type {
  CustomerFollowUp,
  FollowUpTemplate,
  FollowUpListResponse,
  FollowUpStats,
  CalendarEvent,
  CreateFollowUpData,
  UpdateFollowUpData,
  BulkUpdateData,
  AddNoteData,
  RescheduleData,
  CreateTemplateData,
  UpdateTemplateData,
  FollowUpFilters,
  FollowUpNote,
  FollowUpType,
  FollowUpPriority
} from '../types/followUp';

// Follow-up CRUD operations
export const getFollowUps = async (filters?: FollowUpFilters): Promise<FollowUpListResponse> => {
  const response = await api.get('/follow-ups', { params: filters });
  return response.data;
};

export const getFollowUp = async (id: number): Promise<CustomerFollowUp> => {
  const response = await api.get(`/follow-ups/${id}`);
  return response.data;
};

export const createFollowUp = async (data: CreateFollowUpData): Promise<CustomerFollowUp> => {
  const response = await api.post('/follow-ups', data);
  return response.data;
};

export const updateFollowUp = async (id: number, data: UpdateFollowUpData): Promise<CustomerFollowUp> => {
  const response = await api.put(`/follow-ups/${id}`, data);
  return response.data;
};

export const deleteFollowUp = async (id: number): Promise<void> => {
  await api.delete(`/follow-ups/${id}`);
};

// Dashboard and analytics
export const getDashboardStats = async (userId?: number): Promise<FollowUpStats> => {
  const response = await api.get('/follow-ups/dashboard/stats', {
    params: userId ? { user_id: userId } : {}
  });
  return response.data;
};

export const getCalendarData = async (
  startDate: string,
  endDate: string,
  userId?: number
): Promise<CalendarEvent[]> => {
  const response = await api.get('/follow-ups/calendar/data', {
    params: {
      start_date: startDate,
      end_date: endDate,
      ...(userId ? { user_id: userId } : {})
    }
  });
  return response.data;
};

export const getOverdueFollowUps = async (userId?: number): Promise<CustomerFollowUp[]> => {
  const response = await api.get('/follow-ups/overdue', {
    params: userId ? { user_id: userId } : {}
  });
  return response.data;
};

// Bulk operations
export const bulkUpdateFollowUps = async (data: BulkUpdateData): Promise<{ message: string; affected_count: number }> => {
  const response = await api.post('/follow-ups/bulk-update', data);
  return response.data;
};

// Notes
export const addFollowUpNote = async (id: number, data: AddNoteData): Promise<FollowUpNote> => {
  const response = await api.post(`/follow-ups/${id}/notes`, data);
  return response.data;
};

// Actions
export const markFollowUpCompleted = async (id: number, data?: {
  outcome?: string;
  customer_response?: string;
  satisfaction_rating?: number;
  next_actions?: string[];
  additional_notes?: string;
}): Promise<CustomerFollowUp> => {
  const response = await api.post(`/follow-ups/${id}/complete`, data || {});
  return response.data.follow_up;
};

export const rescheduleFollowUp = async (id: number, data: RescheduleData): Promise<CustomerFollowUp> => {
  const response = await api.post(`/follow-ups/${id}/reschedule`, data);
  return response.data.follow_up;
};

// Customer specific
export const getCustomerFollowUps = async (params: {
  customer_phone?: string;
  customer_email?: string;
  woocommerce_customer_id?: number;
}): Promise<CustomerFollowUp[]> => {
  const response = await api.get('/follow-ups/customer/history', { params });
  return response.data;
};

// CallConsole specific methods
export const getCustomerFollowUpsByPhone = async (phoneNumber: string): Promise<CustomerFollowUp[]> => {
  const response = await api.get('/follow-ups/customer/history', { 
    params: { customer_phone: phoneNumber } 
  });
  return response.data;
};

export const createQuickFollowUp = async (data: {
  title: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  customer_phone?: string;
  customer_email?: string;
  customer_name?: string;
  woocommerce_customer_id?: number;
  scheduled_date?: string;
  description?: string;
  woocommerce_order_id?: number | null;
}): Promise<CustomerFollowUp> => {
  // Handle datetime format properly - if no time is included, default to 09:00
  let scheduledDate = data.scheduled_date;
  if (scheduledDate && !scheduledDate.includes('T')) {
    scheduledDate = `${scheduledDate}T09:00:00`;
  } else if (!scheduledDate) {
    // Default to tomorrow at 9 AM
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    scheduledDate = `${tomorrow.toISOString().split('T')[0]}T09:00:00`;
  }
  
  // Build clean data object
  const followUpData: CreateFollowUpData = {
    title: data.title,
    type: data.type,
    priority: data.priority,
    scheduled_date: scheduledDate,
  };

  // Add optional fields if they exist
  if (data.customer_phone) followUpData.customer_phone = data.customer_phone;
  if (data.customer_email) followUpData.customer_email = data.customer_email;
  if (data.customer_name) followUpData.customer_name = data.customer_name;
  if (data.woocommerce_customer_id) followUpData.woocommerce_customer_id = data.woocommerce_customer_id;
  if (data.description) followUpData.description = data.description;
  if (data.woocommerce_order_id) followUpData.woocommerce_order_id = data.woocommerce_order_id;
  
  const response = await api.post('/follow-ups', followUpData);
  return response.data;
};

export const updateFollowUpQuick = async (id: number, data: {
  title?: string;
  description?: string;
  priority?: FollowUpPriority;
  scheduled_date?: string;
  outcome?: string;
  woocommerce_order_id?: number | null;
}): Promise<CustomerFollowUp> => {
  // Handle datetime format for scheduled_date
  const updateData = { ...data };
  if (updateData.scheduled_date && !updateData.scheduled_date.includes('T')) {
    updateData.scheduled_date = `${updateData.scheduled_date}T09:00:00`;
  }
  
  const response = await api.put(`/follow-ups/${id}`, updateData);
  return response.data;
};

export const undoCompleteFollowUp = async (id: number): Promise<CustomerFollowUp> => {
  const response = await api.put(`/follow-ups/${id}`, { status: 'pending' });
  return response.data;
};

export const getFollowUpStats = async (): Promise<FollowUpStats> => {
  const response = await api.get('/follow-ups/dashboard/stats');
  return response.data;
};

// Template operations
export const getTemplates = async (filters?: {
  type?: FollowUpType;
  is_active?: boolean;
  search?: string;
  per_page?: number;
  page?: number;
}): Promise<{ data: FollowUpTemplate[]; pagination: any }> => {
  const response = await api.get('/follow-up-templates', { params: filters });
  return response.data;
};

export const getActiveTemplates = async (): Promise<Record<FollowUpType, FollowUpTemplate[]>> => {
  const response = await api.get('/follow-up-templates/active');
  return response.data;
};

// Utility functions
export const formatFollowUpDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getPriorityColor = (priority: string): string => {
  const colors = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    urgent: '#EF4444'
  };
  return colors[priority as keyof typeof colors] || colors.medium;
};

export const getStatusColor = (status: string): string => {
  const colors = {
    pending: '#6B7280',
    in_progress: '#3B82F6',
    completed: '#10B981',
    cancelled: '#6B7280',
    overdue: '#EF4444'
  };
  return colors[status as keyof typeof colors] || colors.pending;
};