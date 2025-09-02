/**
 * Unified Status Utilities
 * Provides consistent status determination logic across components
 */

// Interface for call objects
interface CallStatusData {
  ended_at?: string | null;
  answered_at?: string | null;
  disposition?: string | null;
}

// Interface for extension objects
interface ExtensionStatusData {
  device_state: string;
  status_code: number;
}

/**
 * Get unified call status from call data
 * This matches the backend logic in callController.js
 */
export const getUnifiedCallStatus = (call: CallStatusData): string => {
  if (call.ended_at) {
    // Call has ended - use disposition or default to 'ended'
    return call.disposition || 'ended';
  } else if (call.answered_at) {
    // Call is answered but not ended
    return 'answered';
  } else {
    // Call is not answered and not ended
    return 'ringing';
  }
};

/**
 * Get unified extension status label from extension data
 * This matches the logic in ExtensionsStatus.tsx
 */
export const getUnifiedExtensionStatus = (extension: ExtensionStatusData): string => {
  // First try to map by device state
  const deviceStateMap: Record<string, string> = {
    'NOT_INUSE': 'Free',
    'INUSE': 'On Call',
    'BUSY': 'Busy',
    'UNAVAILABLE': 'Offline',
    'INVALID': 'Offline',
    'RINGING': 'Ringing',
    'RING*INUSE': 'Call Waiting',
    'ONHOLD': 'On Hold',
    'UNKNOWN': 'Unknown'
  };

  if (extension.device_state && deviceStateMap[extension.device_state]) {
    return deviceStateMap[extension.device_state];
  }

  // Fallback to status code mapping (corrected mapping)
  const statusCodeMap: Record<number, string> = {
    0: 'Free',
    1: 'On Call',
    2: 'Busy',
    4: 'Offline',
    8: 'Ringing',
    16: 'Call Waiting'
  };

  return statusCodeMap[extension.status_code] || 'Unknown';
};

/**
 * Check if extension is in a ringing state
 */
export const isExtensionRinging = (extension: ExtensionStatusData): boolean => {
  return extension.device_state === 'RINGING' || 
         extension.device_state === 'RING*INUSE' ||
         extension.status_code === 8 || 
         extension.status_code === 16;
};

/**
 * Check if extension is actively on a call (not just available)
 */
export const isExtensionOnCall = (extension: ExtensionStatusData): boolean => {
  return extension.device_state !== 'NOT_INUSE' && 
         extension.status_code !== 0 &&
         extension.device_state !== 'UNAVAILABLE' &&
         extension.device_state !== 'INVALID';
};

/**
 * Check if call is in a ringing state
 */
export const isCallRinging = (call: CallStatusData): boolean => {
  return !call.answered_at && !call.ended_at;
};

/**
 * Debug function to log status mismatches
 */
export const debugStatusMismatch = (
  extensionId: string, 
  extensionStatus: string, 
  callStatus?: string,
  additionalInfo?: Record<string, any>
) => {
  if (import.meta.env.DEV) {
    console.group(`🐛 Status Debug - Extension ${extensionId}`);
    console.log('Extension Status:', extensionStatus);
    console.log('Call Status:', callStatus || 'No active call');
    console.log('Timestamp:', new Date().toISOString());
    if (additionalInfo) {
      console.log('Additional Info:', additionalInfo);
    }
    console.groupEnd();
  }
};

/**
 * Get status priority for sorting (ringing calls first)
 */
export const getStatusPriority = (status: string): number => {
  const statusPriority = {
    'ringing': 1,
    'ring': 1,
    'incoming': 1,
    'calling': 1,
    'started': 2,
    'start': 2,
    'answered': 3,
    'in_progress': 3,
  } as Record<string, number>;
  
  return statusPriority[status.toLowerCase()] || 999;
};