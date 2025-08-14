/**
 * Tests for BST date formatting utilities
 */

import {
  toBST,
  formatBSTDateTime,
  formatBSTReadable,
  getRelativeTimeBST,
  isDateExpired,
  isDateExpiringSoon,
  formatBSTCompact
} from './dateUtils';

// Simple test function since we don't have a testing framework setup
export const runDateUtilsTests = () => {
  console.log('🧪 Testing BST Date Utils...');

  // Test with a known ISO date
  const testDate = '2025-01-29T18:30:00.000Z'; // UTC time
  const testDateObj = new Date(testDate);

  console.log('📅 Original UTC Date:', testDate);
  console.log('📅 As Date Object:', testDateObj.toISOString());

  // Test toBST
  const bstDate = toBST(testDate);
  console.log('🌏 BST Date:', bstDate?.toISOString());

  // Test formatBSTDateTime (12-hour format, no timezone)
  const formattedDateTime = formatBSTDateTime(testDate);
  console.log('📝 BST DateTime (12-hour, no GMT):', formattedDateTime);

  // Test formatBSTReadable (12-hour format, no timezone)
  const formattedReadable = formatBSTReadable(testDate);
  console.log('📖 BST Readable (12-hour, no GMT):', formattedReadable);

  // Test getRelativeTimeBST
  const relativeTime = getRelativeTimeBST(testDate);
  console.log('⏰ Relative Time:', relativeTime);

  // Test formatBSTCompact
  const compactFormat = formatBSTCompact(testDate);
  console.log('📦 BST Compact:', compactFormat);

  // Test with future date
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now
  console.log('🔮 Future Date Tests:');
  console.log('  DateTime:', formatBSTDateTime(futureDate));
  console.log('  Relative:', getRelativeTimeBST(futureDate));
  console.log('  Expired:', isDateExpired(futureDate));
  console.log('  Expiring Soon:', isDateExpiringSoon(futureDate));

  // Test with past date
  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  console.log('⏮️ Past Date Tests:');
  console.log('  DateTime:', formatBSTDateTime(pastDate));
  console.log('  Relative:', getRelativeTimeBST(pastDate));
  console.log('  Expired:', isDateExpired(pastDate));

  // Test with null/invalid dates
  console.log('❌ Invalid Date Tests:');
  console.log('  Null:', formatBSTDateTime(null));
  console.log('  Invalid String:', formatBSTDateTime('invalid-date'));
  console.log('  Empty String:', formatBSTDateTime(''));

  console.log('✅ BST Date Utils Tests Completed!');
};

// Export for manual testing
export default runDateUtilsTests; 