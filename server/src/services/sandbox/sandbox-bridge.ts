// ============================================================
// Sandbox Bridge — Chat-to-Sandbox Execution Layer
//
// Bridges agent chat responses to the SandboxService execution
// engine. Detects execution intent, extracts code blocks, runs
// them in the user's sandbox container, returns formatted output.
// ============================================================

import { logger } from '../../logger.js';
import { SandboxService, TierError } from './sandbox-service.js';

// ── Types ───────────────────────────────────────────────────

export interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  outputFiles?: Array<{ name: string; mimeType: string; url: string }>;
  truncated: boolean;
}

// ── Constants ───────────────────────────────────────────────

const MAX_OUTPUT_CHARS = 4000;
const CODE_AGENTS = new Set(['forge', 'edith', 'pulse']);
const EXEC_LANGS = new Set(['javascript', 'typescript', 'python', 'bash', 'sql']);
const FILE_EXTS = new Set(['.xlsx', '.xls', '.csv', '.tsv', '.pdf', '.json', '.xml', '.parquet']);

const LANG_RUNNERS: Record<string, (p: string) => string> = {
  javascript: (p) => `node '${p}'`,
  typescript: (p) => `npx tsx '${p}'`,
  python:     (p) => `python3 '${p}'`,
  bash:       (p) => `bash '${p}'`,
  sql:        (p) => `sqlite3 < '${p}'`,
};

// User says "run this", "execute it", "try it out", "show me the output"
const USER_EXEC_RE = /\b(?:(?:run|execute|eval)\s+(?:this|that|it|the\s+code)|(?:test|try)\s+(?:this|that|it)\s*(?:out|for\s+me)?|can\s+you\s+(?:run|execute|test)|(?:run|execute)\s+(?:it|this)|show\s+me\s+(?:the\s+)?(?:output|result)|what\s+(?:does|would)\s+(?:this|it)\s+(?:output|return|produce))\b/i;

// Agent says "run this", "try running", "let me run", "I'll execute this"
const AGENT_EXEC_RE = /\b(?:(?:run|execute)\s+(?:this|the\s+(?:above|following))|here'?s?\s+(?:the\s+)?(?:code|script)\s+(?:to\s+)?run|try\s+(?:running|executing)|(?:let\s+me|i'?ll?)\s+(?:run|execute)\s+(?:this|that|it))\b/i;

// User wants file processing: "parse my spreadsheet", "analyze the data"
const FILE_PROC_RE = /\b(?:(?:parse|read|open|analyze|process|extract|convert)\s+(?:this|the|my)\s+(?:file|spreadsheet|csv|excel|pdf|document)|(?:upload|attached|here'?s?\s+(?:a|the)\s+file)|(?:chart|graph|plot|visualize|visualization)\s+(?:from|of|for)|data\s+analysis|analyze\s+(?:this|the)\s+data)\b/i;

// ── Core Functions ──────────────────────────────────────────

/**
 * Detect if a message + agent response needs sandbox execution.
 * Returns true when execution is warranted; the caller decides whether to auto-run.
 */
export function needsSandboxExecution(message: string, agentResponse: string, agentId: string): boolean {
  const hasCode = () => extractCodeBlocks(agentResponse).length > 0;

  // User explicitly asked to run + code present
  if (USER_EXEC_RE.test(message) && hasCode()) return true;
  // Agent signals execution + code present
  if (AGENT_EXEC_RE.test(agentResponse) && hasCode()) return true;
  // Code agent + user asked + executable language blocks
  if (CODE_AGENTS.has(agentId) && USER_EXEC_RE.test(message)) {
    if (extractCodeBlocks(agentResponse).some(b => EXEC_LANGS.has(b.language))) return true;
  }
  // File processing request
  if (FILE_PROC_RE.test(message)) return true;
  return false;
}

/** Extract fenced code blocks from an agent response. */
export function extractCodeBlocks(response: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(response)) !== null) {
    const code = m[2].trim();
    if (!code) continue;
    blocks.push({ language: normLang((m[1] || '').toLowerCase()), code, startIndex: m.index });
  }
  return blocks;
}

/** Execute a code block in the user's sandbox container. */
export async function executeSandboxCode(userId: string, userTier: string, code: string, language: string): Promise<SandboxResult> {
  const start = Date.now();
  const lang = normLang(language);
  const runner = LANG_RUNNERS[lang];
  if (!runner) return err(`Unsupported language: ${language}`, start);
  if (!code.trim()) return err('Empty code block.', start);

  logger.info({ userId, userTier, language: lang, codeLen: code.length }, 'Sandbox bridge: executing code');

  try {
    const sbx = await SandboxService.createOrGet(userId, { template: 'code' });
    const tmp = `/workspace/_run_${Date.now()}${langExt(lang)}`;
    await SandboxService.writeFile(userId, sbx.id, tmp, code);
    const result = await SandboxService.exec(userId, sbx.id, runner(tmp));
    SandboxService.exec(userId, sbx.id, `rm -f '${tmp}'`).catch(() => {});

    const truncated = result.stdout.length > MAX_OUTPUT_CHARS;
    return {
      success: result.exitCode === 0,
      stdout: truncated ? result.stdout.slice(0, MAX_OUTPUT_CHARS) : result.stdout,
      stderr: result.stderr, exitCode: result.exitCode,
      durationMs: Date.now() - start, truncated,
    };
  } catch (e) { return handleErr(e, userId, userTier, start); }
}

/** Process a file upload through the sandbox (XLSX, CSV, PDF, etc.). */
export async function processFileInSandbox(userId: string, userTier: string, filePath: string, instruction: string): Promise<SandboxResult> {
  const start = Date.now();
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (!FILE_EXTS.has(ext)) return err(`Unsupported file type: ${ext}`, start);
  if (filePath.includes('..') || filePath.includes('\0')) {
    logger.warn({ userId, filePath }, 'Sandbox bridge: path traversal blocked');
    return err('Invalid file path.', start);
  }

  logger.info({ userId, userTier, ext, instruction: instruction.slice(0, 100) }, 'Sandbox bridge: processing file');

  try {
    const sbx = await SandboxService.createOrGet(userId, { template: 'file' });
    const script = fileScript(filePath, ext, instruction);
    const tmp = `/workspace/_process_${Date.now()}.py`;
    await SandboxService.writeFile(userId, sbx.id, tmp, script);
    const result = await SandboxService.exec(userId, sbx.id, `python3 '${tmp}'`);
    SandboxService.exec(userId, sbx.id, `rm -f '${tmp}'`).catch(() => {});

    const truncated = result.stdout.length > MAX_OUTPUT_CHARS;
    return {
      success: result.exitCode === 0,
      stdout: truncated ? result.stdout.slice(0, MAX_OUTPUT_CHARS) : result.stdout,
      stderr: result.stderr, exitCode: result.exitCode,
      durationMs: Date.now() - start, truncated,
    };
  } catch (e) { return handleErr(e, userId, userTier, start); }
}

/** Format sandbox result for chat display. */
export function formatSandboxOutput(result: SandboxResult): string {
  if (!result.success) {
    return result.stderr
      ? '**Execution error:**\n```\n' + result.stderr.slice(0, 2000) + '\n```'
      : `**Execution failed** (exit code ${result.exitCode})`;
  }
  const parts: string[] = [];
  if (result.stdout) {
    const out = result.truncated ? result.stdout + '\n... (output truncated)' : result.stdout;
    parts.push('```\n' + out + '\n```');
  } else {
    parts.push('_Code executed successfully (no output)._');
  }
  if (result.outputFiles?.length) {
    parts.push('\n**Generated files:**\n' + result.outputFiles.map(f => `- [${f.name}](${f.url})`).join('\n'));
  }
  parts.push(`\n_Completed in ${result.durationMs}ms_`);
  return parts.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────

const LANG_ALIASES: Record<string, string> = {
  js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash',
  shell: 'bash', zsh: 'bash', node: 'javascript', jsx: 'javascript', tsx: 'typescript',
};
function normLang(raw: string): string { return LANG_ALIASES[raw] || raw || 'text'; }

const LANG_EXTS: Record<string, string> = { javascript: '.js', typescript: '.ts', python: '.py', bash: '.sh', sql: '.sql' };
function langExt(lang: string): string { return LANG_EXTS[lang] || '.txt'; }

function err(stderr: string, start: number): SandboxResult {
  return { success: false, stdout: '', stderr, exitCode: 1, durationMs: Date.now() - start, truncated: false };
}

function handleErr(e: unknown, userId: string, userTier: string, start: number): SandboxResult {
  if (e instanceof TierError) return err(`Sandbox requires a paid plan. Current: ${userTier}`, start);
  const msg = e instanceof Error ? e.message : 'Unknown sandbox error';
  logger.error({ err: e, userId }, 'Sandbox bridge: execution failed');
  return err(msg, start);
}

/** Generate a Python processing script for the given file type. */
function fileScript(fp: string, ext: string, instr: string): string {
  const p = fp.replace(/'/g, "\\'");
  const i = instr.replace(/'/g, "\\'").slice(0, 500);
  const head = (lib: string, read: string) =>
    `import ${lib}\ndf = ${read}('${p}')\nprint(f"Rows: {len(df)}, Columns: {list(df.columns)}")\nprint(df.head(20).to_string())\n# ${i}`;

  if (['.xlsx', '.xls'].includes(ext)) return head('pandas as pd', 'pd.read_excel');
  if (ext === '.csv') return head('pandas as pd', 'pd.read_csv');
  if (ext === '.tsv') return `import pandas as pd\ndf = pd.read_csv('${p}', sep='\\t')\nprint(f"Rows: {len(df)}, Columns: {list(df.columns)}")\nprint(df.head(20).to_string())\n# ${i}`;
  if (ext === '.json') return `import json\nwith open('${p}') as f:\n    data = json.load(f)\nif isinstance(data, list):\n    print(f"Array with {len(data)} items")\n    print(json.dumps(data[:5], indent=2))\nelse:\n    print(json.dumps(data, indent=2)[:4000])\n# ${i}`;
  if (ext === '.pdf') return `try:\n    import pdfplumber\n    with pdfplumber.open('${p}') as pdf:\n        for i, page in enumerate(pdf.pages[:5]):\n            print(f"--- Page {i+1} ---")\n            print(page.extract_text() or "(no text)")\nexcept ImportError:\n    print("pdfplumber not installed")\n# ${i}`;
  return `with open('${p}') as f:\n    print(f.read(8000))\n# ${i}`;
}
