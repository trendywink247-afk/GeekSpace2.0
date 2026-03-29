import { useState, useEffect, useCallback } from 'react';
import { Braces, Minimize2, Copy, Check, AlertCircle } from 'lucide-react';

export function JsonFormatterPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<{ message: string; line?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const charCount = output.length || input.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  // ── Syntax highlighter (regex-based, no heavy library) ──────
  function highlight(json: string): string {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = 'text-[#61FF7B]'; // number
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-[#a78bfa]'; // key — violet
            } else {
              cls = 'text-[#fbbf24]'; // string value — amber
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-[#34d399]'; // boolean — emerald
          } else if (/null/.test(match)) {
            cls = 'text-[#f87171]'; // null — red
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  }

  // ── Locate line number of JSON error ───────────────────────
  function getErrorLine(text: string, err: SyntaxError): number | undefined {
    const match = err.message.match(/position (\d+)/);
    if (!match) return undefined;
    const pos = parseInt(match[1], 10);
    return text.slice(0, pos).split('\n').length;
  }

  // ── Format ──────────────────────────────────────────────────
  const format = useCallback(() => {
    const src = input.trim();
    if (!src) return;
    try {
      const parsed = JSON.parse(src);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutput(formatted);
      setError(null);
    } catch (e) {
      const line = getErrorLine(src, e as SyntaxError);
      setError({ message: (e as Error).message, line });
      setOutput('');
    }
  }, [input]);

  // ── Minify ──────────────────────────────────────────────────
  const minify = useCallback(() => {
    const src = input.trim();
    if (!src) return;
    try {
      const parsed = JSON.parse(src);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setError(null);
    } catch (e) {
      const line = getErrorLine(src, e as SyntaxError);
      setError({ message: (e as Error).message, line });
      setOutput('');
    }
  }, [input]);

  // ── Copy ────────────────────────────────────────────────────
  const copy = useCallback(async () => {
    const text = output || input;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output, input]);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'F') { e.preventDefault(); format(); }
        if (e.key === 'M') { e.preventDefault(); minify(); }
        if (e.key === 'C') { e.preventDefault(); copy(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [format, minify, copy]);

  // ── Auto-validate on paste ──────────────────────────────────
  function handleChange(val: string) {
    setInput(val);
    setOutput('');
    if (!val.trim()) { setError(null); return; }
    try {
      JSON.parse(val);
      setError(null);
    } catch (e) {
      const line = getErrorLine(val, e as SyntaxError);
      setError({ message: (e as Error).message, line });
    }
  }

  const displayContent = output || input;

  return (
    <div className="space-y-5 p-4 pb-24 md:pb-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="gs-section-label mb-1">Developer Tools</p>
          <h2 className="text-lg font-semibold text-[#E8E8F0]">JSON Formatter</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Format, minify, and validate JSON — estimate token cost</p>
        </div>
        {charCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <span className="gs-pill font-mono">
              {charCount.toLocaleString()} chars
            </span>
            <span className="gs-pill gs-pill-active font-mono">
              ~{tokenEstimate.toLocaleString()} tokens
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={format}
          className="gs-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl"
          title="Ctrl+Shift+F"
        >
          <Braces className="w-3.5 h-3.5" />
          Format
          <span className="text-[10px] opacity-60 ml-1">⌃⇧F</span>
        </button>
        <button
          onClick={minify}
          className="gs-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl"
          title="Ctrl+Shift+M"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Minify
          <span className="text-[10px] opacity-60 ml-1">⌃⇧M</span>
        </button>
        <button
          onClick={copy}
          disabled={!displayContent}
          className="gs-btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl disabled:opacity-40"
          title="Ctrl+Shift+C"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
          <span className="text-[10px] opacity-60 ml-1">⌃⇧C</span>
        </button>
        {input && (
          <button
            onClick={() => { setInput(''); setOutput(''); setError(null); }}
            className="ml-auto text-sm text-[#6B7280] hover:text-[#f87171] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="gs-card flex items-start gap-2 border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] p-3 text-sm">
          <AlertCircle className="w-4 h-4 text-[#f87171] mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[#f87171] font-medium">Invalid JSON</span>
            {error.line && <span className="text-[#f87171]/70 ml-2 text-xs">Line {error.line}</span>}
            <p className="text-[#f87171]/80 text-xs mt-1 font-mono">{error.message}</p>
          </div>
        </div>
      )}

      {/* Editor / output area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="flex flex-col gap-1.5">
          <label className="gs-section-label">Input</label>
          <textarea
            className="gs-input font-mono text-sm resize-none min-h-[360px] placeholder:text-[#3A3A4A]"
            placeholder="Paste your JSON here..."
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-1.5">
          <label className="gs-section-label flex items-center gap-2">
            Output
            {output && (
              <span className="text-emerald-400 normal-case font-normal text-[10px] tracking-normal">✓ valid</span>
            )}
          </label>
          {output ? (
            <div
              className="gs-card font-mono text-sm p-3 overflow-auto min-h-[360px] whitespace-pre leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlight(output) }}
            />
          ) : (
            <div className="gs-card font-mono text-sm p-3 min-h-[360px] flex items-center justify-center text-[#3A3A4A]">
              Formatted output will appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
