import { EventEmitter } from 'events';

export interface AgentinEvents {
  'reminder.created': { userId: string; reminderId: string; text: string };
  'habit.logged': { userId: string; habitName: string; streak: number };
  'streak.milestone': { userId: string; habitName: string; streak: number };
  'streak.broken': { userId: string; habitName: string; previousStreak: number };
  'expense.spike': { userId: string; amount: number; category: string; averageForCategory: number };
  'memory.stored': { userId: string; key: string };
  'pico:task': { event: string; taskId: string; taskType: string; userId: string; result?: string; error?: string; attempt?: number; retryAfter?: string };
}

class TypedEventBus {
  private emitter = new EventEmitter();
  constructor() { this.emitter.setMaxListeners(100); }
  emit<K extends keyof AgentinEvents>(event: K, data: AgentinEvents[K]): void {
    this.emitter.emit(event, data);
  }
  on<K extends keyof AgentinEvents>(event: K, handler: (data: AgentinEvents[K]) => void): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }
  off<K extends keyof AgentinEvents>(event: K, handler: (data: AgentinEvents[K]) => void): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }
}

export const eventBus = new TypedEventBus();
