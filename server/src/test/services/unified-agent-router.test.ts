import { describe, it, expect } from 'vitest';
import { parseMentions, selectAgent, classifyMessageComplexity, resolveSpecialist, getAgentAutocompleteList } from '../../services/unified-agent-router.js';

describe('parseMentions', () => {
  it('parses @weebo mention', () => {
    const result = parseMentions('@weebo help me with something');
    expect(result.mentionedAgents).toContain('weebo');
    expect(result.cleanMessage).toBe('help me with something');
  });

  it('parses multiple mentions', () => {
    const result = parseMentions('@weebo @edith what do you think?');
    expect(result.mentionedAgents).toContain('weebo');
    expect(result.mentionedAgents).toContain('edith');
  });

  it('handles no mentions', () => {
    const result = parseMentions('just a normal message');
    expect(result.mentionedAgents).toHaveLength(0);
    expect(result.cleanMessage).toBe('just a normal message');
  });

  it('parses natural language mentions', () => {
    const result = parseMentions('hey weebo can you help');
    expect(result.mentionedAgents).toContain('weebo');
  });

  it('parses colon-style mentions', () => {
    const result = parseMentions('edith: review this code');
    expect(result.mentionedAgents).toContain('edith');
  });

  it('parses specialist mentions', () => {
    const result = parseMentions('@aria design a logo');
    expect(result.mentionedAgents).toContain('aria');
  });

  it('is case insensitive', () => {
    const result = parseMentions('@Weebo @EDITH hello');
    expect(result.mentionedAgents).toContain('weebo');
    expect(result.mentionedAgents).toContain('edith');
  });
});

describe('selectAgent', () => {
  it('routes to mentioned agent', () => {
    const result = selectAgent({
      userId: 'test',
      message: '@edith review this',
      channel: 'web',
    });
    expect(result.primaryAgent).toBe('edith');
    expect(result.isMultiAgent).toBe(false);
  });

  it('detects multi-agent when multiple mentions', () => {
    const result = selectAgent({
      userId: 'test',
      message: '@weebo @edith help',
      channel: 'web',
    });
    expect(result.isMultiAgent).toBe(true);
  });

  it('routes terminal to edith', () => {
    const result = selectAgent({
      userId: 'test',
      message: 'run a command',
      channel: 'terminal',
    });
    expect(result.primaryAgent).toBe('edith');
  });

  it('routes builder to forge', () => {
    const result = selectAgent({
      userId: 'test',
      message: 'build a website',
      channel: 'builder',
    });
    expect(result.primaryAgent).toBe('forge');
  });

  it('falls back to user default', () => {
    const result = selectAgent({
      userId: 'test',
      message: 'hello there',
      channel: 'web',
    }, 'weebo');
    expect(result.primaryAgent).toBe('weebo');
  });

  it('falls back to jarvis when no default', () => {
    const result = selectAgent({
      userId: 'test',
      message: 'hello there',
      channel: 'web',
    });
    expect(result.primaryAgent).toBe('jarvis');
  });
});

describe('classifyMessageComplexity', () => {
  it('classifies greetings', () => {
    expect(classifyMessageComplexity('hello')).toBe('greeting');
    expect(classifyMessageComplexity('hi!')).toBe('greeting');
    expect(classifyMessageComplexity('namaste')).toBe('greeting');
  });

  it('classifies tool use', () => {
    expect(classifyMessageComplexity('remind me to call mom')).toBe('tool_use');
    expect(classifyMessageComplexity('search for react tutorials')).toBe('tool_use');
    expect(classifyMessageComplexity('generate an image of a cat')).toBe('tool_use');
  });

  it('classifies multi-agent', () => {
    expect(classifyMessageComplexity('launch mode: plan my startup')).toBe('multi_agent');
    expect(classifyMessageComplexity('get all perspectives on this')).toBe('multi_agent');
  });

  it('classifies simple messages', () => {
    expect(classifyMessageComplexity('what is the weather today')).toBe('simple');
    expect(classifyMessageComplexity('tell me a joke')).toBe('simple');
  });
});

describe('resolveSpecialist', () => {
  it('core agents resolve to themselves', () => {
    expect(resolveSpecialist('weebo')).toEqual({ coreAgent: 'weebo', specialist: null });
    expect(resolveSpecialist('edith')).toEqual({ coreAgent: 'edith', specialist: null });
    expect(resolveSpecialist('jarvis')).toEqual({ coreAgent: 'jarvis', specialist: null });
  });

  it('aria resolves to weebo', () => {
    expect(resolveSpecialist('aria')).toEqual({ coreAgent: 'weebo', specialist: 'aria' });
  });

  it('forge resolves to edith', () => {
    expect(resolveSpecialist('forge')).toEqual({ coreAgent: 'edith', specialist: 'forge' });
  });

  it('cal resolves to jarvis', () => {
    expect(resolveSpecialist('cal')).toEqual({ coreAgent: 'jarvis', specialist: 'cal' });
  });
});

describe('getAgentAutocompleteList', () => {
  it('returns all 9 agents', () => {
    const list = getAgentAutocompleteList();
    expect(list).toHaveLength(9);
  });

  it('has core agents first', () => {
    const list = getAgentAutocompleteList();
    const coreAgents = list.filter(a => a.isCore);
    expect(coreAgents).toHaveLength(3);
    // Core agents should be before specialists
    const firstNonCore = list.findIndex(a => !a.isCore);
    const lastCore = list.length - 1 - [...list].reverse().findIndex(a => a.isCore);
    expect(lastCore).toBeLessThan(firstNonCore);
  });

  it('each agent has required fields', () => {
    const list = getAgentAutocompleteList();
    for (const agent of list) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.emoji).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(typeof agent.isCore).toBe('boolean');
    }
  });
});
