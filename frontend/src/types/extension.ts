export interface Extension {
  _id: string;
  extension: string;
  agent_name: string | null;
  team: string | null;
  team_id: number | null;
  team_name: string | null;
  status_code: number;
  status_text: string | null; // Database field from Asterisk
  availability_status: 'online' | 'offline' | 'unknown' | 'invalid';
  status_changed_at: string | null; // When availability status last changed
  device_state: string; // Computed property
  is_active: boolean;
  department: string | null; // Alias for team for backward compatibility
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionStatusUpdate {
  extension: string;
  agent_name: string | null;
  team: string | null;
  team_id: number | null;
  team_name: string | null;
  availability_status: 'online' | 'offline' | 'unknown' | 'invalid';
  status_changed_at: string | null; // When availability status last changed
  status_code: number;
  status_text: string | null; // Database field from Asterisk
  device_state: string; // Computed property
  department: string | null; // Alias for team for backward compatibility
  is_active: boolean;
}

export interface CreateExtensionRequest {
  extension: string;
  agent_name?: string;
  team?: string;
  department?: string; // Support both for backward compatibility
  is_active?: boolean;
}

export interface UpdateExtensionRequest {
  agent_name?: string;
  team?: string;
  department?: string; // Support both for backward compatibility
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

// Availability status constants
export const AVAILABILITY_STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
  INVALID: 'invalid'
} as const;

