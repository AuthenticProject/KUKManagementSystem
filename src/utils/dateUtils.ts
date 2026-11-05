/**
 * Enterprise Date & Timezone Utilities
 * Standardized for Asia/Jakarta (WIB, UTC+7) and end-of-month calendar arithmetic
 */

/**
 * Returns current date string in YYYY-MM-DD format for Asia/Jakarta timezone.
 * Avoids UTC date shift between 00:00 and 06:59 WIB.
 */
export function getWIBDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns current time string in HH:mm:ss format for Asia/Jakarta timezone.
 */
export function getWIBTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Calculates expiry date with end-of-month clamp to prevent JavaScript Date month rollover.
 * Example: Aug 31 + 6 months -> Feb 28 (or 29 in leap year), not March 3.
 */
export function calculateSpExpiryDate(issuedDateStr: string, monthsToAdd: number = 6): string {
  if (!issuedDateStr) {
    issuedDateStr = getWIBDateString();
  }
  const [yearStr, monthStr, dayStr] = issuedDateStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const d = parseInt(dayStr, 10);

  const targetTotalMonths = y * 12 + (m - 1) + monthsToAdd;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonth = (targetTotalMonths % 12) + 1;

  // Days in target month (day 0 of month+1 gives last day of target month)
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const clampedDay = Math.min(d, daysInTargetMonth);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${targetYear}-${pad(targetMonth)}-${pad(clampedDay)}`;
}

