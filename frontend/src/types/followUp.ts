// Follow-up Types and Interfaces

export type FollowUpType = 
  | 'sales_call'
  | 'order_followup'
  | 'payment_reminder'
  | 'delivery_check'
  | 'feedback_request'
  | 'upsell_opportunity'
  | 'complaint_resolution'
  | 'general_check_in';

export type FollowUpPriority = 'low' | 'medium' | 'high' | 'urgent';

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';

export type FollowUpNoteType = 'note' | 'status_change' | 'system';

export interface User {
  id: number;
  name: string;
  email: string;
  extension?: string;
}

export interface FollowUpNote {
  id: number;
  follow_up_id: number;
  user_id: number;
  note: string;
  type: FollowUpNoteType;
  attachments?: string[];
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface CustomerFollowUp {
  id: number;
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  customer_phone?: string;
  customer_email?: string;
  customer_name?: string;
  woocommerce_customer_id?: number;
  woocommerce_order_id?: number;
  scheduled_date: string;
  completed_date?: string;
  reminder_date?: string;
  is_recurring: boolean;
  recurring_pattern?: string;
  recurring_interval?: number;
  assigned_to?: number;
  created_by: number;
  tags?: string[];
  metadata?: Record<string, any>;
  outcome?: string;
  last_reminder_sent?: string;
  reminder_count: number;
  created_at: string;
  updated_at: string;
  
  // Relationships
  assignedUser?: User;
  creator?: User;
  notes?: FollowUpNote[];
  
  // Computed properties
  is_overdue?: boolean;
  formatted_scheduled_date?: string;
  priority_color?: string;
}

export interface FollowUpTemplate {
  id: number;
  name: string;
  description?: string;
  title_template: string;
  description_template: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  default_days_offset: number;
  is_active: boolean;
  created_by: number;
  default_tags?: string[];
  created_at: string;
  updated_at: string;
  creator?: User;
}

export interface FollowUpFilters {
  status?: FollowUpStatus;
  type?: FollowUpType;
  priority?: FollowUpPriority;
  assigned_to?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface FollowUpListResponse {
  data: CustomerFollowUp[];
  pagination: PaginationMeta;
}

export interface FollowUpStats {
  total_pending: number;
  overdue: number;
  due_today: number;
  completed_today: number;
  by_priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  by_type: Record<FollowUpType, number>;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    type: FollowUpType;
    priority: FollowUpPriority;
    status: FollowUpStatus;
    customer_name?: string;
    assigned_user?: string;
  };
}

export interface CreateFollowUpData {
  title: string;
  description?: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  customer_phone?: string;
  customer_email?: string;
  customer_name?: string;
  woocommerce_customer_id?: number;
  woocommerce_order_id?: number;
  scheduled_date: string;
  assigned_to?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateFollowUpData extends Partial<CreateFollowUpData> {
  status?: FollowUpStatus;
  outcome?: string;
}

export interface BulkUpdateData {
  follow_up_ids: number[];
  updates: {
    status?: FollowUpStatus;
    assigned_to?: number;
    priority?: FollowUpPriority;
  };
}

export interface AddNoteData {
  note: string;
  type?: FollowUpNoteType;
}

export interface RescheduleData {
  scheduled_date: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  title_template: string;
  description_template: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  default_days_offset: number;
  is_active?: boolean;
  default_tags?: string[];
}

export interface UpdateTemplateData extends Partial<CreateTemplateData> {}

// Constants
export const FOLLOW_UP_TYPES: { value: FollowUpType; label: string; icon: string }[] = [
  { value: 'sales_call', label: 'Sales Call', icon: 'Phone' },
  { value: 'order_followup', label: 'Order Follow-up', icon: 'Package' },
  { value: 'payment_reminder', label: 'Payment Reminder', icon: 'CreditCard' },
  { value: 'delivery_check', label: 'Delivery Check', icon: 'Truck' },
  { value: 'feedback_request', label: 'Feedback Request', icon: 'MessageSquare' },
  { value: 'upsell_opportunity', label: 'Upsell Opportunity', icon: 'TrendingUp' },
  { value: 'complaint_resolution', label: 'Complaint Resolution', icon: 'AlertTriangle' },
  { value: 'general_check_in', label: 'General Check-in', icon: 'Users' },
];

export const FOLLOW_UP_PRIORITIES: { value: FollowUpPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'urgent', label: 'Urgent', color: '#EF4444' },
];

export const FOLLOW_UP_STATUSES: { value: FollowUpStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: '#6B7280' },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
  { value: 'completed', label: 'Completed', color: '#10B981' },
  { value: 'cancelled', label: 'Cancelled', color: '#6B7280' },
  { value: 'overdue', label: 'Overdue', color: '#EF4444' },
]; 