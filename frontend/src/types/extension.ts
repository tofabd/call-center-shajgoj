export interface Extension {
  _id: string;
  extension: string;
  agent_name: string | null;
  status_code: number;
  device_state: string;
  status: 'online' | 'offline' | 'unknown';
  last_status_change: string | null;
  last_seen: string | null;
  is_active: boolean;
  department: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionStatusUpdate {
  extension: string;
  agent_name: string | null;
  status: 'online' | 'offline' | 'unknown';
  status_code: number;
  device_state: string;
  last_status_change: string | null;
  last_seen: string | null;
  department: string | null;
  is_active: boolean;
}

export interface CreateExtensionRequest {
  extension: string;
  agent_name?: string;
  department?: string;
  is_active?: boolean;
}

export interface UpdateExtensionRequest {
  agent_name?: string;
  department?: string;
  is_active?: boolean;
}

// Status code constants
export const STATUS_CODES = {
  NOT_INUSE: 0,
  INUSE: 1,
  BUSY: 2,
  UNAVAILABLE: 4,
  RINGING: 8,
  RING_INUSE: 16,
  UNKNOWN: -1
} as const;

// Device state constants
export const DEVICE_STATES = {
  NOT_INUSE: 'NOT_INUSE',
  INUSE: 'INUSE',
  BUSY: 'BUSY',
  INVALID: 'INVALID',
  UNAVAILABLE: 'UNAVAILABLE',
  RINGING: 'RINGING',
  RING_INUSE: 'RING*INUSE',
  ONHOLD: 'ONHOLD',
  UNKNOWN: 'UNKNOWN'
} as const;

// Status constants
export const STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
} as const;
