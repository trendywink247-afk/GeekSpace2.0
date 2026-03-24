// ============================================================
// SandboxBridge Unit Tests
//
// Tests intent detection, code block extraction, execution
// routing, and output formatting. Pure functions — no Docker
// or DB mocking needed.
// ============================================================

import { describe, it, expect, vi } from 'vitest';

// Mock logger before importing
vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  needsSandboxExecution,
  extractCodeBlocks,
  executeSandboxCode,
  processFileInSandbox,
  formatSandboxOutput,
} from '../../services/sandbox/sandbox-bridge.js';
import type { CodeBlock, SandboxResult } from '../../services/sandbox/sandbox-bridge.js';

// ===========================================================================
// Tests
// ===========================================================================

describe('SandboxBridge', () => {
  // -----------------------------------------------------------------------
  // Detection — needsSandboxExecution()
  // -----------------------------------------------------------------------

  describe('Detection', () => {
    describe('should detect "run this" requests', () => {
      const codeResponse = 'Here is the code:\n```javascript\nconsole.log("hi")\n```';

      it('detects "run this" pattern', () => {
        expect(needsSandboxExecution('run this', codeResponse, 'weebo')).toBe(true);
      });

      it('detects "run it" pattern', () => {
        expect(needsSandboxExecution('can you run it', codeResponse, 'weebo')).toBe(true);
      });

      it('detects "execute this" pattern', () => {
        expect(needsSandboxExecution('execute this for me', codeResponse, 'weebo')).toBe(true);
      });

      it('detects "test this out" pattern', () => {
        expect(needsSandboxExecution('test this out', codeResponse, 'weebo')).toBe(true);
      });

      it('detects "show me the output" pattern', () => {
        expect(needsSandboxExecution('show me the output', codeResponse, 'weebo')).toBe(true);
      });

      it('detects "what does this output" pattern', () => {
        expect(needsSandboxExecution('what does this output', codeResponse, 'weebo')).toBe(true);
      });
    });

    describe('should detect code blocks needing execution', () => {
      it('detects agent response with "run this" signal + code', () => {
        const agentResponse = 'Run this code:\n```python\nprint("hello")\n```';
        expect(needsSandboxExecution('help me', agentResponse, 'weebo')).toBe(true);
      });

      it('detects "try running" signal in agent response', () => {
        const agentResponse = 'Try running the following:\n```bash\nls -la\n```';
        expect(needsSandboxExecution('what is in my directory', agentResponse, 'weebo')).toBe(true);
      });

      it('detects "execute the above" signal', () => {
        const agentResponse = '```js\n2+2\n```\nExecute the above to see the result.';
        expect(needsSandboxExecution('help', agentResponse, 'weebo')).toBe(true);
      });

      it('detects "let me run" signal from agent', () => {
        const agentResponse = "Let me run this for you:\n```python\nimport os\nos.getcwd()\n```";
        expect(needsSandboxExecution('check my environment', agentResponse, 'weebo')).toBe(true);
      });
    });

    describe('should detect file processing requests', () => {
      it('detects "analyze this file" pattern', () => {
        expect(needsSandboxExecution('analyze this file for trends', '', 'weebo')).toBe(true);
      });

      it('detects "parse the spreadsheet" pattern', () => {
        expect(needsSandboxExecution('parse the spreadsheet', '', 'weebo')).toBe(true);
      });

      it('detects "process this csv" pattern', () => {
        expect(needsSandboxExecution('process this csv please', '', 'weebo')).toBe(true);
      });

      it('detects "chart from data" pattern', () => {
        expect(needsSandboxExecution('chart from this data', '', 'weebo')).toBe(true);
      });

      it('detects data analysis requests', () => {
        expect(needsSandboxExecution('data analysis on the sales numbers', '', 'weebo')).toBe(true);
      });

      it('detects "upload" mention', () => {
        expect(needsSandboxExecution("here's a file I uploaded", '', 'weebo')).toBe(true);
      });
    });

    describe('should NOT trigger for simple chat', () => {
      it('does not trigger for greetings', () => {
        expect(needsSandboxExecution('hello', 'Hi there! How can I help?', 'weebo')).toBe(false);
      });

      it('does not trigger for questions without code', () => {
        expect(needsSandboxExecution('what is javascript?', 'JavaScript is a programming language...', 'weebo')).toBe(false);
      });

      it('does not trigger for general conversation', () => {
        expect(needsSandboxExecution('tell me a joke', 'Why did the programmer quit? No comment!', 'weebo')).toBe(false);
      });

      it('does not trigger when response has code but no run signal', () => {
        // Agent provides code but neither user nor agent asked to run it
        const response = 'Here is how you would do it:\n```javascript\nconsole.log("example")\n```\nDoes this help?';
        expect(needsSandboxExecution('how do I log in javascript?', response, 'weebo')).toBe(false);
      });

      it('does not trigger for plain text run mentions without code', () => {
        // User says "run" but there is no code in the response
        expect(needsSandboxExecution('run this', 'I need more context. What would you like to run?', 'weebo')).toBe(false);
      });
    });

    describe('code agent special handling', () => {
      it('triggers for code agent (forge) with executable code + user run intent', () => {
        const response = '```javascript\nconsole.log("built")\n```';
        expect(needsSandboxExecution('run this code', response, 'forge')).toBe(true);
      });

      it('triggers for code agent (edith) with user run intent', () => {
        const response = '```python\nprint("edited")\n```';
        expect(needsSandboxExecution('can you run this', response, 'edith')).toBe(true);
      });

      it('triggers for code agent (pulse) with user run intent', () => {
        const response = '```bash\necho "deployed"\n```';
        expect(needsSandboxExecution('execute it', response, 'pulse')).toBe(true);
      });

      it('does NOT trigger for code agent without user run intent', () => {
        const response = '```javascript\nconsole.log("demo")\n```\nHere is how it works.';
        // Forge produced code, but user did not ask to run it
        expect(needsSandboxExecution('explain this function', response, 'forge')).toBe(false);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Code extraction — extractCodeBlocks()
  // -----------------------------------------------------------------------

  describe('Code extraction', () => {
    it('should extract JavaScript code blocks', () => {
      const response = 'Here you go:\n```javascript\nconsole.log("hello")\n```\nDone!';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].code).toBe('console.log("hello")');
      expect(blocks[0].startIndex).toBeGreaterThanOrEqual(0);
    });

    it('should extract Python code blocks', () => {
      const response = '```python\nprint("hello")\nfor i in range(5):\n    print(i)\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('python');
      expect(blocks[0].code).toContain('print("hello")');
      expect(blocks[0].code).toContain('for i in range(5)');
    });

    it('should handle multiple code blocks', () => {
      const response = [
        'First:\n```javascript\nconst a = 1;\n```',
        'Second:\n```python\nx = 2\n```',
        'Third:\n```bash\necho hi\n```',
      ].join('\n\n');

      const blocks = extractCodeBlocks(response);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[1].language).toBe('python');
      expect(blocks[2].language).toBe('bash');
    });

    it('should normalize language aliases (js -> javascript)', () => {
      const response = '```js\nconst x = 1;\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
    });

    it('should normalize ts -> typescript', () => {
      const response = '```ts\nconst x: number = 1;\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('typescript');
    });

    it('should normalize py -> python', () => {
      const response = '```py\nx = 1\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('python');
    });

    it('should normalize sh -> bash', () => {
      const response = '```sh\necho hello\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('bash');
    });

    it('should normalize shell -> bash', () => {
      const response = '```shell\nls -la\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('bash');
    });

    it('should normalize node -> javascript', () => {
      const response = '```node\nconsole.log(42)\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('javascript');
    });

    it('should normalize jsx -> javascript', () => {
      const response = '```jsx\nconst App = () => <div/>;\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('javascript');
    });

    it('should normalize tsx -> typescript', () => {
      const response = '```tsx\nconst App: React.FC = () => <div/>;\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].language).toBe('typescript');
    });

    it('should handle code blocks with no language specified', () => {
      const response = '```\nsome raw code\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('text');
      expect(blocks[0].code).toBe('some raw code');
    });

    it('should skip empty code blocks', () => {
      const response = '```javascript\n\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(0);
    });

    it('should preserve code whitespace/indentation', () => {
      const code = 'function foo() {\n    const x = 1;\n    return x;\n}';
      const response = '```javascript\n' + code + '\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks[0].code).toBe(code);
    });

    it('should return empty array when no code blocks exist', () => {
      const response = 'Just some regular text without any code blocks.';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toEqual([]);
    });

    it('should capture startIndex for each block', () => {
      const response = 'prefix\n```js\na\n```\nmore text\n```py\nb\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].startIndex).toBe(response.indexOf('```js'));
      expect(blocks[1].startIndex).toBe(response.indexOf('```py'));
    });

    it('should handle unknown languages without crashing', () => {
      const response = '```rust\nfn main() {}\n```';
      const blocks = extractCodeBlocks(response);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('rust');
    });
  });

  // -----------------------------------------------------------------------
  // Execution — executeSandboxCode()
  // -----------------------------------------------------------------------

  describe('Execution', () => {
    it('should reject unsupported languages', async () => {
      const result = await executeSandboxCode('user-1', 'pro', 'fn main() {}', 'rust');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unsupported language');
    });

    it('should reject empty code blocks', async () => {
      const result = await executeSandboxCode('user-1', 'pro', '   ', 'javascript');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Empty code block');
    });

    it('should fail gracefully when sandbox service unavailable', async () => {
      // executeSandboxCode now calls SandboxService which needs Docker.
      // Without Docker available, it returns an error via handleErr.
      const result = await executeSandboxCode('user-1', 'pro', 'console.log(1)', 'javascript');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      // Error message will reference Docker or sandbox unavailability
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('should accept all executable languages', async () => {
      const languages = ['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'bash', 'sh', 'shell', 'sql'];

      for (const lang of languages) {
        const result = await executeSandboxCode('user-1', 'pro', 'code here', lang);
        // Should not fail with "unsupported language" -- exitCode 126 is the Phase 2 placeholder
        expect(result.stderr).not.toContain('Unsupported language');
      }
    });

    it('should track durationMs', async () => {
      const result = await executeSandboxCode('user-1', 'pro', 'console.log(1)', 'javascript');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should not be truncated for Phase 2 placeholder', async () => {
      const result = await executeSandboxCode('user-1', 'pro', 'x', 'javascript');
      expect(result.truncated).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // File processing — processFileInSandbox()
  // -----------------------------------------------------------------------

  describe('File processing', () => {
    it('should accept supported file types', async () => {
      const supported = [
        'data.xlsx', 'report.csv', 'document.pdf',
        'config.json', 'feed.xml', 'data.parquet',
      ];

      for (const file of supported) {
        const result = await processFileInSandbox('user-1', 'pro', file, 'analyze');
        expect(result.stderr).not.toContain('Unsupported file type');
      }
    });

    it('should reject unsupported file types', async () => {
      const result = await processFileInSandbox('user-1', 'pro', 'binary.exe', 'run');
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Unsupported file type');
    });

    it('should block directory traversal in file path', async () => {
      // Note: ../../etc/passwd has ext extracted from lastIndexOf('.') which
      // gives a nonsensical ext first. Only paths with valid extensions
      // reach the traversal check. Test with a valid ext + traversal:
      const result = await processFileInSandbox('user-1', 'pro', '../../etc/data.csv', 'read');
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid file path');
    });

    it('should block null byte injection in file path', async () => {
      // Use a valid extension before the null byte
      const result = await processFileInSandbox('user-1', 'pro', 'evil\0.csv', 'analyze');
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid file path');
    });

    it('should fail gracefully for valid files when sandbox unavailable', async () => {
      // processFileInSandbox now calls SandboxService which needs Docker.
      // Without Docker, it fails gracefully via handleErr.
      const result = await processFileInSandbox('user-1', 'pro', 'sales.csv', 'summarize');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('should handle files with no extension', async () => {
      const result = await processFileInSandbox('user-1', 'pro', 'Makefile', 'parse');
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Unsupported file type');
    });
  });

  // -----------------------------------------------------------------------
  // Output formatting — formatSandboxOutput()
  // -----------------------------------------------------------------------

  describe('Output formatting', () => {
    it('should format successful execution with stdout', () => {
      const result: SandboxResult = {
        success: true,
        stdout: 'hello world',
        stderr: '',
        exitCode: 0,
        durationMs: 42,
        truncated: false,
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('```');
      expect(output).toContain('hello world');
      expect(output).toContain('42ms');
    });

    it('should format successful execution with no output', () => {
      const result: SandboxResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 10,
        truncated: false,
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('no output');
    });

    it('should format failed execution with stderr', () => {
      const result: SandboxResult = {
        success: false,
        stdout: '',
        stderr: 'TypeError: undefined is not a function',
        exitCode: 1,
        durationMs: 5,
        truncated: false,
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('Execution error');
      expect(output).toContain('TypeError');
    });

    it('should format failed execution without stderr', () => {
      const result: SandboxResult = {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 137,
        durationMs: 5,
        truncated: false,
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('Execution failed');
      expect(output).toContain('137');
    });

    it('should show truncation indicator', () => {
      const result: SandboxResult = {
        success: true,
        stdout: 'a'.repeat(5000),
        stderr: '',
        exitCode: 0,
        durationMs: 100,
        truncated: true,
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('truncated');
    });

    it('should include output files when present', () => {
      const result: SandboxResult = {
        success: true,
        stdout: 'Chart generated',
        stderr: '',
        exitCode: 0,
        durationMs: 200,
        truncated: false,
        outputFiles: [
          { name: 'chart.png', mimeType: 'image/png', url: '/sandbox/files/chart.png' },
          { name: 'data.csv', mimeType: 'text/csv', url: '/sandbox/files/data.csv' },
        ],
      };

      const output = formatSandboxOutput(result);
      expect(output).toContain('Generated files');
      expect(output).toContain('chart.png');
      expect(output).toContain('data.csv');
    });

    it('should not show files section when outputFiles is empty', () => {
      const result: SandboxResult = {
        success: true,
        stdout: 'done',
        stderr: '',
        exitCode: 0,
        durationMs: 10,
        truncated: false,
        outputFiles: [],
      };

      const output = formatSandboxOutput(result);
      expect(output).not.toContain('Generated files');
    });
  });
});
