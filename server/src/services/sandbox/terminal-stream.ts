// Terminal Stream Manager — SSE streaming for sandbox terminal output
//
// Per-sandbox terminal sessions with SSE fan-out. SandboxService pipes
// dockerode exec output through broadcast() or pipeStream().
//
// Wire format:  event: terminal\ndata: {"type":"stdout","data":"...",...}\n\n

import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { logger } from '../../logger.js';

// ---- Types ----

export interface TerminalEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'system' | 'error';
  data: string;
  timestamp: number;
  command?: string;
}

export interface TerminalSession {
  sandboxId: string;
  userId: string;
  clients: Map<string, Response>;
  history: TerminalEvent[];
  createdAt: number;
}

const MAX_HISTORY = 100;
const KEEPALIVE_MS = 15_000;

type Flushable = Response & { flush?: () => void };
const flush = (res: Response) => { (res as Flushable).flush?.(); };

// ---- Manager ----

class TerminalStreamManager {
  private sessions = new Map<string, TerminalSession>();
  private heartbeats = new Map<string, NodeJS.Timeout>();

  /** Create a terminal session for a sandbox. Returns existing if already active. */
  createSession(sandboxId: string, userId: string): TerminalSession {
    const existing = this.sessions.get(sandboxId);
    if (existing) return existing;

    const session: TerminalSession = {
      sandboxId, userId, clients: new Map(), history: [], createdAt: Date.now(),
    };
    this.sessions.set(sandboxId, session);
    logger.info({ sandboxId, userId }, 'Terminal session created');
    return session;
  }

  /** Get an active session, or null. */
  getSession(sandboxId: string): TerminalSession | null {
    return this.sessions.get(sandboxId) ?? null;
  }

  /** Broadcast a terminal event to every connected SSE client. */
  broadcast(sandboxId: string, event: TerminalEvent): void {
    const session = this.sessions.get(sandboxId);
    if (!session) return;

    session.history.push(event);
    if (session.history.length > MAX_HISTORY) {
      session.history.splice(0, session.history.length - MAX_HISTORY);
    }

    const payload = `event: terminal\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [clientId, res] of session.clients) {
      try { res.write(payload); flush(res); }
      catch { session.clients.delete(clientId); }
    }
  }

  /** Connect an SSE client to a sandbox terminal stream. Returns clientId. */
  addClient(sandboxId: string, res: Response): string {
    const session = this.sessions.get(sandboxId);
    if (!session) { res.status(404).end(); return ''; }

    const clientId = randomUUID();

    // SSE headers (matches existing agent-state pattern)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity',
    });
    res.write(':connected\n\n');
    flush(res);

    // Replay buffered history so late joiners see recent output
    for (const event of session.history) {
      try { res.write(`event: terminal\ndata: ${JSON.stringify(event)}\n\n`); }
      catch { return clientId; }
    }
    flush(res);

    session.clients.set(clientId, res);
    this.ensureHeartbeat(sandboxId);
    logger.debug({ sandboxId, clientId }, 'Terminal SSE client connected');
    return clientId;
  }

  /** Disconnect a specific SSE client. */
  removeClient(sandboxId: string, clientId: string): void {
    const session = this.sessions.get(sandboxId);
    if (!session) return;

    session.clients.delete(clientId);
    logger.debug({ sandboxId, clientId }, 'Terminal SSE client disconnected');

    if (session.clients.size === 0) this.clearHeartbeat(sandboxId);
  }

  /** Tear down a session entirely (sandbox destroyed). */
  destroySession(sandboxId: string): void {
    const session = this.sessions.get(sandboxId);
    if (!session) return;

    const goodbye: TerminalEvent = {
      type: 'system', data: 'Sandbox terminated', timestamp: Date.now(),
    };
    const payload = `event: terminal\ndata: ${JSON.stringify(goodbye)}\n\n`;
    for (const [, res] of session.clients) {
      try { res.write(payload); res.end(); } catch { /* already closed */ }
    }

    session.clients.clear();
    session.history.length = 0;
    this.clearHeartbeat(sandboxId);
    this.sessions.delete(sandboxId);
    logger.info({ sandboxId }, 'Terminal session destroyed');
  }

  /** Pipe a Node.js Readable (e.g. dockerode exec stream) into this session. */
  pipeStream(sandboxId: string, stream: NodeJS.ReadableStream, command?: string): void {
    stream.on('data', (chunk: Buffer | string) => {
      this.broadcast(sandboxId, {
        type: 'stdout', data: chunk.toString(), timestamp: Date.now(), command,
      });
    });
    stream.on('error', (err: Error) => {
      this.broadcast(sandboxId, {
        type: 'error', data: err.message, timestamp: Date.now(), command,
      });
    });
    stream.on('end', () => {
      this.broadcast(sandboxId, {
        type: 'exit', data: '0', timestamp: Date.now(), command,
      });
    });
  }

  // ---- Internals ----

  private ensureHeartbeat(sandboxId: string): void {
    if (this.heartbeats.has(sandboxId)) return;

    const interval = setInterval(() => {
      const session = this.sessions.get(sandboxId);
      if (!session || session.clients.size === 0) {
        this.clearHeartbeat(sandboxId);
        return;
      }
      for (const [clientId, res] of session.clients) {
        try { res.write(': keepalive\n\n'); flush(res); }
        catch { session.clients.delete(clientId); }
      }
    }, KEEPALIVE_MS);

    this.heartbeats.set(sandboxId, interval);
  }

  private clearHeartbeat(sandboxId: string): void {
    const interval = this.heartbeats.get(sandboxId);
    if (interval) { clearInterval(interval); this.heartbeats.delete(sandboxId); }
  }
}

export const terminalStream = new TerminalStreamManager();
