// ============================================================
// Action Receipts Service — Show users what the agent DID
//
// Creates visual confirmation of actions taken
// Tool receipts, progress indicators, action chips
// ============================================================


export interface ReceiptItem {
  icon: string;
  text: string;
  details?: string;
  link?: string;
}

export interface ActionReceipt {
  title: string;
  items: ReceiptItem[];
  timestamp: string;
}

// ---- Receipt Templates ----

export const RECEIPT_TEMPLATES = {
  reminder: (text: string, when: string): ReceiptItem => ({
    icon: '⏰',
    text: 'Reminder scheduled',
    details: `"${text}" — ${when}`,
  }),

  note: (title: string): ReceiptItem => ({
    icon: '📝',
    text: 'Note saved',
    details: title,
  }),

  plan: (title: string, steps: number): ReceiptItem => ({
    icon: '📋',
    text: 'Plan created',
    details: `${title} — ${steps} steps`,
  }),

  email: (recipient: string): ReceiptItem => ({
    icon: '📧',
    text: 'Email drafted',
    details: `To: ${recipient}`,
  }),

  whatsapp: (message: string): ReceiptItem => ({
    icon: '📲',
    text: 'Sent to WhatsApp',
    details: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
  }),

  telegram: (message: string): ReceiptItem => ({
    icon: '✈️',
    text: 'Sent to Telegram',
    details: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
  }),

  project: (name: string): ReceiptItem => ({
    icon: '📁',
    text: 'Project card created',
    details: name,
  }),

  automation: (name: string): ReceiptItem => ({
    icon: '⚡',
    text: 'Automation started',
    details: name,
  }),

  task: (title: string): ReceiptItem => ({
    icon: '✅',
    text: 'Task queued',
    details: title,
  }),

  website: (title: string, url: string): ReceiptItem => ({
    icon: '🌐',
    text: 'Website generated',
    details: title,
    link: url,
  }),

  export: (format: string, filename: string): ReceiptItem => ({
    icon: '📤',
    text: `Exported as ${format}`,
    details: filename,
  }),

  memory: (key: string): ReceiptItem => ({
    icon: '🧠',
    text: 'Remembered',
    details: key,
  }),

  image: (prompt: string): ReceiptItem => ({
    icon: '🖼️',
    text: 'Image generated',
    details: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
  }),

  video: (prompt: string): ReceiptItem => ({
    icon: '🎬',
    text: 'Video generated',
    details: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
  }),

  avatar: (): ReceiptItem => ({
    icon: '👤',
    text: 'Avatar updated',
    details: 'Profile picture generated',
  }),
};

// ---- Format Receipt for Display ----

export function formatReceipt(receipt: ActionReceipt): string {
  const lines = [
    `✨ *${receipt.title}*`,
    '',
    ...receipt.items.map(item =>
      `${item.icon} *${item.text}*${item.details ? `\n   _${item.details}_` : ''}`
    ),
    '',
    `_${receipt.timestamp}_`,
  ];

  return lines.join('\n');
}

export function formatReceiptCompact(items: ReceiptItem[]): string {
  if (items.length === 0) return '';

  if (items.length === 1) {
    const item = items[0];
    return `${item.icon} ${item.text}${item.details ? ` — _${item.details}_` : ''}`;
  }

  // Multiple items - compact format
  return items.map(item => `${item.icon} ${item.text}`).join(' • ');
}

// ---- Progress Indicators ----

export function createProgressIndicator(
  step: number,
  total: number,
  action: string
): string {
  const progressBar = '█'.repeat(step) + '░'.repeat(total - step);
  return `⏳ *Step ${step}/${total}:* ${action}\n[${progressBar}]`;
}

export const PROGRESS_STEPS = {
  analyze: (step: number, total: number) =>
    createProgressIndicator(step, total, 'Analyzing your request...'),

  plan: (step: number, total: number) =>
    createProgressIndicator(step, total, 'Creating your plan...'),

  generate: (step: number, total: number) =>
    createProgressIndicator(step, total, 'Generating output...'),

  save: (step: number, total: number) =>
    createProgressIndicator(step, total, 'Saving to your workspace...'),

  complete: () => '✅ *Complete!*',
};

// ---- Action Chips ----

export interface ActionChip {
  text: string;
  callback_data: string;
  style?: 'primary' | 'secondary';
}

export function getDefaultActionChips(context?: string): ActionChip[] {
  const baseChips: ActionChip[] = [
    { text: '✅ Save', callback_data: 'chip_save', style: 'primary' },
    { text: '⏰ Remind me', callback_data: 'chip_remind' },
    { text: '🔁 Improve', callback_data: 'chip_improve' },
    { text: '🧠 Remember this', callback_data: 'chip_remember' },
  ];

  const exportChips: ActionChip[] = [
    { text: '📲 WhatsApp', callback_data: 'chip_whatsapp' },
    { text: '✈️ Telegram', callback_data: 'chip_telegram' },
    { text: '🧾 Export', callback_data: 'chip_export' },
  ];

  if (context === 'plan') {
    return [
      { text: '✅ Save Plan', callback_data: 'chip_save_plan', style: 'primary' },
      { text: '⏰ Set Reminders', callback_data: 'chip_remind_plan' },
      { text: '📤 Export PDF', callback_data: 'chip_export_pdf' },
      { text: '🔁 Refine', callback_data: 'chip_improve' },
    ];
  }

  if (context === 'draft') {
    return [
      { text: '✅ Save Draft', callback_data: 'chip_save_draft', style: 'primary' },
      { text: '📋 Copy', callback_data: 'chip_copy' },
      { text: '📧 Send Email', callback_data: 'chip_send_email' },
      { text: '✏️ Edit', callback_data: 'chip_edit' },
    ];
  }

  if (context === 'reminder') {
    return [
      { text: '✅ Confirm', callback_data: 'chip_confirm', style: 'primary' },
      { text: '📲 WhatsApp', callback_data: 'chip_whatsapp' },
      { text: '⏰ Snooze', callback_data: 'chip_snooze' },
    ];
  }

  if (context === 'website') {
    return [
      { text: '🌐 View Live', callback_data: 'chip_view', style: 'primary' },
      { text: '🔗 Copy Link', callback_data: 'chip_copy_url' },
      { text: '📤 Export', callback_data: 'chip_export' },
    ];
  }

  return [...baseChips, ...exportChips].slice(0, 4);
}

// ---- Receipt Builder ----

export class ReceiptBuilder {
  private items: ReceiptItem[] = [];
  private title = 'Actions Completed';

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  add(item: ReceiptItem): this {
    this.items.push(item);
    return this;
  }

  addReminder(text: string, when: string): this {
    return this.add(RECEIPT_TEMPLATES.reminder(text, when));
  }

  addNote(title: string): this {
    return this.add(RECEIPT_TEMPLATES.note(title));
  }

  addPlan(title: string, steps: number): this {
    return this.add(RECEIPT_TEMPLATES.plan(title, steps));
  }

  addProject(name: string): this {
    return this.add(RECEIPT_TEMPLATES.project(name));
  }

  addExport(format: string, filename: string): this {
    return this.add(RECEIPT_TEMPLATES.export(format, filename));
  }

  build(): ActionReceipt {
    return {
      title: this.title,
      items: this.items,
      timestamp: new Date().toLocaleString(),
    };
  }

  format(): string {
    return formatReceipt(this.build());
  }

  formatCompact(): string {
    return formatReceiptCompact(this.items);
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

// ---- Convenience Function ----

export function createReceipt(): ReceiptBuilder {
  return new ReceiptBuilder();
}
