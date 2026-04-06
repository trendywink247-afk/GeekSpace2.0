// ============================================================
// Natural Language Reminder Parser
// Converts text like "Remind me tomorrow at 3pm to call mom"
// into structured reminder data
// ============================================================

export interface ParsedReminder {
  text: string;
  datetime: Date;
  recurring?: 'daily' | 'weekly' | 'monthly';
  confidence: number; // 0-1
}

// Time patterns
const timePatterns = [
  // 3pm, 3:30pm, 15:00
  { regex: /(\d{1,2}):?(\d{2})?\s*(am|pm)/i, parser: parseStandardTime },
  // morning, afternoon, evening, night
  { regex: /(morning|afternoon|evening|night)/i, parser: parseTimeOfDay },
  // noon, midnight
  { regex: /(noon|midnight)/i, parser: parseNoonMidnight },
];

// Date patterns
const datePatterns = [
  // today, tomorrow, yesterday
  { regex: /\b(today|tomorrow|yesterday)\b/i, parser: parseRelativeDay },
  // Monday, Tuesday, etc
  { regex: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, parser: parseWeekday },
  // in 5 minutes, in 2 hours
  { regex: /in\s+(\d+)\s+(minute|hour|day|week)s?/i, parser: parseInDuration },
  // next week, next month
  { regex: /\b(next week|next month)\b/i, parser: parseNextPeriod },
  // specific dates: Jan 15, January 15th, 15th Jan
  { regex: /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i, parser: parseMonthDay },
];

// Recurring patterns
const recurringPatterns = [
  { regex: /\b(daily|every day)\b/i, value: 'daily' as const },
  { regex: /\b(weekly|every week)\b/i, value: 'weekly' as const },
  { regex: /\b(monthly|every month)\b/i, value: 'monthly' as const },
  { regex: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: 'weekly' as const },
];

function parseStandardTime(match: RegExpMatchArray, baseDate: Date): Date | null {
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();
  
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function parseTimeOfDay(match: RegExpMatchArray, baseDate: Date): Date | null {
  const timeOfDay = match[1].toLowerCase();
  const result = new Date(baseDate);
  
  switch (timeOfDay) {
    case 'morning': result.setHours(9, 0, 0, 0); break;
    case 'afternoon': result.setHours(14, 0, 0, 0); break;
    case 'evening': result.setHours(18, 0, 0, 0); break;
    case 'night': result.setHours(21, 0, 0, 0); break;
  }
  return result;
}

function parseNoonMidnight(match: RegExpMatchArray, baseDate: Date): Date | null {
  const result = new Date(baseDate);
  if (match[1].toLowerCase() === 'noon') {
    result.setHours(12, 0, 0, 0);
  } else {
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function parseRelativeDay(match: RegExpMatchArray, baseDate: Date): Date | null {
  const result = new Date(baseDate);
  const day = match[1].toLowerCase();
  
  switch (day) {
    case 'today': break;
    case 'tomorrow': result.setDate(result.getDate() + 1); break;
    case 'yesterday': result.setDate(result.getDate() - 1); break;
  }
  return result;
}

function parseWeekday(match: RegExpMatchArray, baseDate: Date): Date | null {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = weekdays.indexOf(match[1].toLowerCase());
  const result = new Date(baseDate);
  
  let daysUntil = targetDay - result.getDay();
  if (daysUntil <= 0) daysUntil += 7; // Next occurrence
  
  result.setDate(result.getDate() + daysUntil);
  return result;
}

function parseInDuration(match: RegExpMatchArray, baseDate: Date): Date | null {
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const result = new Date(baseDate);
  
  switch (unit) {
    case 'minute': result.setMinutes(result.getMinutes() + amount); break;
    case 'hour': result.setHours(result.getHours() + amount); break;
    case 'day': result.setDate(result.getDate() + amount); break;
    case 'week': result.setDate(result.getDate() + amount * 7); break;
  }
  return result;
}

function parseNextPeriod(match: RegExpMatchArray, baseDate: Date): Date | null {
  const result = new Date(baseDate);
  const period = match[1].toLowerCase();
  
  if (period === 'next week') {
    result.setDate(result.getDate() + 7);
  } else if (period === 'next month') {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

function parseMonthDay(match: RegExpMatchArray, baseDate: Date): Date | null {
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8, sept: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  
  const month = months[match[1].toLowerCase()];
  const day = parseInt(match[2], 10);
  
  if (month === undefined || isNaN(day)) return null;
  
  const result = new Date(baseDate);
  result.setMonth(month, day);
  
  // If date has passed this year, set for next year
  if (result < baseDate) {
    result.setFullYear(result.getFullYear() + 1);
  }
  
  return result;
}

function extractReminderText(input: string): string {
  // Remove common reminder prefixes
  let text = input
    .replace(/^remind me (to |that |about )?/i, '')
    .replace(/^set a reminder (to |for )?/i, '')
    .replace(/^don't forget (to |about )?/i, '')
    .replace(/^make sure (to )?/i, '');
  
  // Remove time/date patterns from the text
  for (const pattern of [...timePatterns, ...datePatterns]) {
    text = text.replace(pattern.regex, '');
  }
  
  // Remove recurring patterns
  for (const pattern of recurringPatterns) {
    text = text.replace(pattern.regex, '');
  }
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Remove leading "to " if present
  text = text.replace(/^to /i, '');
  
  return text;
}

function detectRecurring(input: string): 'daily' | 'weekly' | 'monthly' | undefined {
  for (const pattern of recurringPatterns) {
    if (pattern.regex.test(input)) {
      return pattern.value;
    }
  }
  return undefined;
}

export function parseNaturalLanguageReminder(input: string): ParsedReminder | null {
  const now = new Date();
  let datetime: Date | null = null;
  let confidence = 0;
  
  // Try to parse time
  for (const pattern of timePatterns) {
    const match = input.match(pattern.regex);
    if (match) {
      datetime = pattern.parser(match, datetime || now);
      confidence += 0.3;
      break;
    }
  }
  
  // Try to parse date
  for (const pattern of datePatterns) {
    const match = input.match(pattern.regex);
    if (match) {
      datetime = pattern.parser(match, datetime || now);
      confidence += 0.3;
      break;
    }
  }
  
  // If no date/time found, default to tomorrow 9am
  if (!datetime) {
    datetime = new Date(now);
    datetime.setDate(datetime.getDate() + 1);
    datetime.setHours(9, 0, 0, 0);
    confidence += 0.1;
  }
  
  // If time not specified, default to 9am
  if (datetime.getHours() === now.getHours() && datetime.getMinutes() === now.getMinutes()) {
    datetime.setHours(9, 0, 0, 0);
  }
  
  // Extract reminder text
  const text = extractReminderText(input);
  if (text) confidence += 0.3;
  
  // Detect recurring
  const recurring = detectRecurring(input);
  
  return {
    text: text || input,
    datetime,
    recurring,
    confidence: Math.min(confidence, 1),
  };
}

// Examples:
// "Remind me tomorrow at 3pm to call mom"
// "Every Monday at 9am team standup"
// "In 2 hours take a break"
// "Next week on Tuesday submit report"
// "Daily at 8am drink water"
