// ============================================================
// Indian Festival Calendar Service
//
// Comprehensive calendar of Indian festivals, national holidays,
// business deadlines, and cultural events for 2026.
// Used by: agent system prompt, proactive engine, message router.
// ============================================================

export interface FestivalEvent {
  date: string;       // YYYY-MM-DD
  name: string;       // English name
  nameHi: string;     // Hindi name
  type: 'religious' | 'national' | 'business' | 'regional' | 'sports';
  region: 'all' | 'north' | 'south' | 'east' | 'west';
  agentContext: string;
  proactiveAction?: string | null;
}

export const INDIAN_CALENDAR_2026: FestivalEvent[] = [
  { date: '2026-01-26', name: 'Republic Day', nameHi: 'गणतंत्र दिवस', type: 'national', region: 'all', agentContext: 'National holiday — patriotic greeting', proactiveAction: 'Block Republic Day in calendar' },
  { date: '2026-03-06', name: 'Holi', nameHi: 'होली', type: 'religious', region: 'all', agentContext: 'Festival of colors — joyful greeting', proactiveAction: 'Remind about gifting 3 days before' },
  { date: '2026-03-15', name: 'IPL 2026 Start', nameHi: 'IPL 2026', type: 'sports', region: 'all', agentContext: 'Cricket season begins', proactiveAction: 'Ask if user wants match reminders' },
  { date: '2026-03-30', name: 'Eid ul-Fitr', nameHi: 'ईद', type: 'religious', region: 'all', agentContext: 'Eid Mubarak greeting', proactiveAction: null },
  { date: '2026-03-31', name: 'Financial Year End', nameHi: 'वित्त वर्ष समाप्ति', type: 'business', region: 'all', agentContext: 'TAX — ITR filing, investments, audit', proactiveAction: 'Tax filing reminder starting Feb 1' },
  { date: '2026-04-14', name: 'Ambedkar Jayanti', nameHi: 'आंबेडकर जयंती', type: 'national', region: 'all', agentContext: 'National holiday', proactiveAction: null },
  { date: '2026-04-14', name: 'Baisakhi', nameHi: 'बैसाखी', type: 'regional', region: 'north', agentContext: 'Harvest festival in Punjab/North India', proactiveAction: null },
  { date: '2026-04-15', name: 'Good Friday', nameHi: 'गुड फ्राइडे', type: 'national', region: 'all', agentContext: 'Public holiday', proactiveAction: null },
  { date: '2026-07-31', name: 'ITR Filing Deadline', nameHi: 'आयकर दाखिल अंतिम तिथि', type: 'business', region: 'all', agentContext: 'Income tax return deadline', proactiveAction: 'Countdown reminder from July 1' },
  { date: '2026-08-15', name: 'Independence Day', nameHi: 'स्वतंत्रता दिवस', type: 'national', region: 'all', agentContext: 'Jai Hind! National pride greeting', proactiveAction: 'Flag hoisting reminder morning of' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', nameHi: 'गांधी जयंती', type: 'national', region: 'all', agentContext: 'National holiday', proactiveAction: null },
  { date: '2026-10-20', name: 'Dussehra', nameHi: 'दशहरा', type: 'religious', region: 'all', agentContext: 'Victory of good over evil — festive greeting', proactiveAction: 'Shopping budget check 5 days before' },
  { date: '2026-11-08', name: 'Diwali', nameHi: 'दीपावली', type: 'religious', region: 'all', agentContext: 'BIGGEST FESTIVAL — full gifting/decoration workflow', proactiveAction: 'Gifting list + budget planning 2 weeks before' },
  { date: '2026-11-09', name: 'Govardhan Puja', nameHi: 'गोवर्धन पूजा', type: 'religious', region: 'north', agentContext: 'Day after Diwali', proactiveAction: null },
  { date: '2026-12-25', name: 'Christmas', nameHi: 'क्रिसमस', type: 'national', region: 'all', agentContext: 'Merry Christmas greeting', proactiveAction: null },
];

export function getUpcomingFestivals(daysAhead: number = 14): FestivalEvent[] {
  const today = new Date();
  const future = new Date(today.getTime() + daysAhead * 86400000);
  return INDIAN_CALENDAR_2026.filter(f => {
    const d = new Date(f.date + 'T00:00:00');
    return d >= today && d <= future;
  });
}

export function getTodayFestival(): FestivalEvent | null {
  const today = new Date().toISOString().split('T')[0];
  return INDIAN_CALENDAR_2026.find(f => f.date === today) ?? null;
}

export function getFestivalContext(): string {
  const today = getTodayFestival();
  const upcoming = getUpcomingFestivals(3);
  if (today) return `Today is ${today.name} (${today.nameHi}). ${today.agentContext}`;
  if (upcoming.length > 0) return `Upcoming: ${upcoming.map(f => `${f.name} (${f.nameHi})`).join(', ')} in the next 3 days`;
  return '';
}
