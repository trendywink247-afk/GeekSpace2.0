// ============================================================
// Action Parser Unit Tests
// Covers parseActions() with valid/invalid/malformed inputs.
// Pure function — no DB or external deps required.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseActions } from '../../services/action-parser.js';

describe('parseActions', () => {
  // ── Basic parsing ───────────────────────────────────────

  it('returns empty actions and full text when no action blocks present', () => {
    const result = parseActions('Hello, how can I help you today?');
    expect(result.actions).toHaveLength(0);
    expect(result.text).toBe('Hello, how can I help you today?');
  });

  it('parses a valid generate_code action', () => {
    const llm = `I'll build that for you!
<<<ACTION
{ "tool": "generate_code", "params": { "title": "Hello World", "html": "<h1>Hello</h1>", "css": "h1 { color: cyan; }", "js": "" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('generate_code');
    expect(result.actions[0].params.title).toBe('Hello World');
    expect(result.actions[0].params.html).toBe('<h1>Hello</h1>');
    // Action block should be stripped from text
    expect(result.text).not.toContain('ACTION');
    expect(result.text).toContain("I'll build that for you!");
  });

  it('parses a set_reminder action', () => {
    const llm = `Setting that reminder now!
<<<ACTION
{ "tool": "set_reminder", "params": { "text": "Call dentist", "datetime": "2026-03-01 09:00:00", "channel": "telegram", "category": "health" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('set_reminder');
    expect(result.actions[0].params.text).toBe('Call dentist');
    expect(result.actions[0].params.channel).toBe('telegram');
  });

  it('parses a portfolio_add_project action', () => {
    const llm = `<<<ACTION
{ "tool": "portfolio_add_project", "params": { "title": "My App", "description": "A cool app", "tags": ["react", "typescript"] } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('portfolio_add_project');
    expect(result.actions[0].params.tags).toEqual(['react', 'typescript']);
  });

  it('parses generate_image action', () => {
    const llm = `Generating your image!
<<<ACTION
{ "tool": "generate_image", "params": { "prompt": "a futuristic city at night", "width": 1024, "height": 1024 } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('generate_image');
    expect(result.actions[0].params.prompt).toBe('a futuristic city at night');
    expect(result.actions[0].params.width).toBe(1024);
  });

  it('parses generate_video action', () => {
    const llm = `<<<ACTION
{ "tool": "generate_video", "params": { "prompt": "a rocket launching into space", "duration": 5 } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('generate_video');
    expect(result.actions[0].params.duration).toBe(5);
  });

  it('skips portfolio_update_theme (removed — use generate_code instead)', () => {
    const llm = `<<<ACTION
{ "tool": "portfolio_update_theme", "params": { "accentColor": "#ff2d78" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(0);
  });

  // ── Multiple actions ────────────────────────────────────

  it('parses multiple action blocks in sequence', () => {
    const llm = `Sure!
<<<ACTION
{ "tool": "set_reminder", "params": { "text": "Team meeting", "datetime": "2026-03-01 10:00:00" } }
ACTION>>>
And also:
<<<ACTION
{ "tool": "portfolio_update_bio", "params": { "bio": "Full-stack developer" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].tool).toBe('set_reminder');
    expect(result.actions[1].tool).toBe('portfolio_update_bio');
  });

  // ── Invalid / malformed ─────────────────────────────────

  it('skips action blocks with invalid JSON', () => {
    const llm = `<<<ACTION
{ this is not valid json }
ACTION>>>
Here is my response.`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(0);
    expect(result.text).toContain('Here is my response.');
  });

  it('skips action blocks with unknown tool', () => {
    const llm = `<<<ACTION
{ "tool": "hack_the_planet", "params": {} }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(0);
  });

  it('skips action blocks with invalid params (theme: bad hex)', () => {
    const llm = `<<<ACTION
{ "tool": "portfolio_update_theme", "params": { "accentColor": "not-a-hex" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(0);
  });

  it('skips action blocks with missing required params', () => {
    const llm = `<<<ACTION
{ "tool": "send_email", "params": {} }
ACTION>>>`;
    // send_email requires subject and body
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(0);
  });

  it('strips action blocks from text even when params are invalid', () => {
    const llm = `Before the block.
<<<ACTION
{ "tool": "unknown_tool", "params": {} }
ACTION>>>
After the block.`;
    const result = parseActions(llm);
    expect(result.text).toContain('Before the block.');
    expect(result.text).toContain('After the block.');
    expect(result.text).not.toContain('ACTION');
  });

  // ── LLM formatting quirks ────────────────────────────────

  it('handles unescaped newlines in JSON string values', () => {
    // LLMs sometimes emit literal newlines inside JSON strings
    const llm = '<<<ACTION\n{ "tool": "portfolio_update_bio", "params": { "bio": "line one\\nline two" } }\nACTION>>>';
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('portfolio_update_bio');
  });

  it('handles triple-angle ACTION>>> closing', () => {
    const llm = `<<<ACTION
{ "tool": "set_reminder", "params": { "text": "Water plants" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
  });

  // ── Defaults ────────────────────────────────────────────

  it('applies Zod defaults for optional fields (generate_code html/css/js)', () => {
    const llm = `<<<ACTION
{ "tool": "generate_code", "params": { "title": "Minimal" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].params.html).toBe('');
    expect(result.actions[0].params.css).toBe('');
    expect(result.actions[0].params.js).toBe('');
  });

  it('applies Zod defaults for crawl_url priority', () => {
    const llm = `<<<ACTION
{ "tool": "crawl_url", "params": { "url": "https://example.com" } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].params.priority).toBe(5);
  });

  // ── Edge cases ───────────────────────────────────────────

  it('handles empty string input', () => {
    const result = parseActions('');
    expect(result.actions).toHaveLength(0);
    expect(result.text).toBe('');
  });

  it('handles response that is only an action block (no surrounding text)', () => {
    const llm = `<<<ACTION
{ "tool": "portfolio_update_skills", "params": { "skills": ["TypeScript", "React", "Node.js"] } }
ACTION>>>`;
    const result = parseActions(llm);
    expect(result.actions).toHaveLength(1);
    expect(result.text.trim()).toBe('');
  });
});
