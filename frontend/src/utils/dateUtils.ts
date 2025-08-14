/**
 * Date utility functions for BST (Bangladesh Standard Time) formatting
 */

/**
 * Convert any date to Bangladesh Standard Time (BST)
 * BST is UTC+6
 */
export const toBST = (date: string | Date | null): Date | null => {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date provided to toBST:', date);
      return null;
    }
    
    return dateObj;
  } catch (error) {
    console.error('Error converting date to BST:', error);
    return null;
  }
};

/**
 * Format a date in BST with full date and time information
 */
export const formatBSTDateTime = (date: string | Date | null): string => {
  const bstDate = toBST(date);
  if (!bstDate) return 'Invalid Date';

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka', // Bangladesh timezone
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true // Changed to 12-hour format with AM/PM
      // Removed timeZoneName to hide GMT+6
    }).format(bstDate);
  } catch (error) {
    console.error('Error formatting BST date:', error);
    return 'Format Error';
  }
};

/**
 * Format a date in BST with readable format
 */
export const formatBSTReadable = (date: string | Date | null): string => {
  const bstDate = toBST(date);
  if (!bstDate) return 'Invalid Date';

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka', // Bangladesh timezone
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
      // Removed timeZoneName to hide GMT+6
    }).format(bstDate);
  } catch (error) {
    console.error('Error formatting BST readable date:', error);
    return 'Format Error';
  }
};

/**
 * Get relative time in BST (e.g., "2 hours ago", "in 3 days")
 */
export const getRelativeTimeBST = (date: string | Date | null): string => {
  const bstDate = toBST(date);
  if (!bstDate) return 'Invalid Date';

  try {
    const now = new Date();
    const diffMs = bstDate.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Future dates
    if (diffMs > 0) {
      if (diffMinutes < 60) {
        return `in ${diffMinutes} minutes`;
      } else if (diffHours < 24) {
        return `in ${diffHours} hours`;
      } else {
        return `in ${diffDays} days`;
      }
    }
    
    // Past dates
    const absDiffMinutes = Math.abs(diffMinutes);
    const absDiffHours = Math.abs(diffHours);
    const absDiffDays = Math.abs(diffDays);

    if (absDiffMinutes < 60) {
      return `${absDiffMinutes} minutes ago`;
    } else if (absDiffHours < 24) {
      return `${absDiffHours} hours ago`;
    } else {
      return `${absDiffDays} days ago`;
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'Time Error';
  }
};

/**
 * Check if a date is expired (past current time)
 */
export const isDateExpired = (date: string | Date | null): boolean => {
  const bstDate = toBST(date);
  if (!bstDate) return true;

  return bstDate.getTime() < Date.now();
};

/**
 * Check if a date is expiring soon (within specified minutes)
 */
export const isDateExpiringSoon = (date: string | Date | null, withinMinutes: number = 5): boolean => {
  const bstDate = toBST(date);
  if (!bstDate) return true;

  const now = new Date();
  const diffMs = bstDate.getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes <= withinMinutes && diffMinutes > 0;
};

/**
 * Format a date for display in tables or compact views
 */
export const formatBSTCompact = (date: string | Date | null): string => {
  const bstDate = toBST(date);
  if (!bstDate) return '--';

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true // Changed to 12-hour format with AM/PM
    }).format(bstDate);
  } catch (error) {
    console.error('Error formatting BST compact date:', error);
    return 'Error';
  }
};

export default {
  toBST,
  formatBSTDateTime,
  formatBSTReadable,
  getRelativeTimeBST,
  isDateExpired,
  isDateExpiringSoon,
  formatBSTCompact
}; 