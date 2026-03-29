import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
              cls = 'text-[#7B61FF]'; // key
            } else {
              cls = 'text-[#FFD700]'; // string value
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-[#8B5CF6]'; // boolean
          } else if (/null/.test(match)) {
            cls = 'text-[#FF6B6B]'; // null
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
    <div className="space-y-4 p-4 pb-24 md:pb-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#E8E8F0]">JSON Formatter</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Format, minify, and validate JSON — estimate token cost</p>
        </div>
        {charCount > 0 && (
          <div className="flex items-center gap-3 text-xs text-[#6B7280]">
            <span className="font-mono bg-[#0D0D14] border border-[#2A2A3A] rounded px-2 py-1">
              {charCount.toLocaleString()} chars
            </span>
            <span className="font-mono bg-[#0D0D14] border border-[#7B61FF]/40 rounded px-2 py-1 text-[#7B61FF]">
              ~{tokenEstimate.toLocaleString()} tokens
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={format}
          className="bg-[#7B61FF] hover:bg-[#6A50EE] text-white gap-1.5"
          title="Ctrl+Shift+F"
        >
          <Braces className="w-3.5 h-3.5" />
          Format
          <span className="text-[10px] opacity-60 ml-1">⌃⇧F</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={minify}
          className="border-[#2A2A3A] text-[#A0A0B0] hover:text-[#E8E8F0] gap-1.5"
          title="Ctrl+Shift+M"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Minify
          <span className="text-[10px] opacity-60 ml-1">⌃⇧M</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copy}
          className="border-[#2A2A3A] text-[#A0A0B0] hover:text-[#E8E8F0] gap-1.5"
          title="Ctrl+Shift+C"
          disabled={!displayContent}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#61FF7B]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
          <span className="text-[10px] opacity-60 ml-1">⌃⇧C</span>
        </Button>
        {input && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setInput(''); setOutput(''); setError(null); }}
            className="text-[#6B7280] hover:text-[#FF6B6B] ml-auto"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 text-[#FF6B6B] mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[#FF6B6B] font-medium">Invalid JSON</span>
            {error.line && <span className="text-[#FF6B6B]/70 ml-2 text-xs">Line {error.line}</span>}
            <p className="text-[#FF6B6B]/80 text-xs mt-1 font-mono">{error.message}</p>
          </div>
        </div>
      )}

      {/* Editor / output area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">Input</label>
          <textarea
            className="font-mono text-sm bg-[#0D0D14] border border-[#2A2A3A] rounded-lg p-3 text-[#E8E8F0] resize-none focus:outline-none focus:border-[#7B61FF]/60 min-h-[360px] placeholder:text-[#3A3A4A]"
            placeholder="Paste your JSON here..."
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">
            Output
            {output && (
              <span className="ml-2 text-[#61FF7B] normal-case font-normal">✓ valid</span>
            )}
          </label>
          {output ? (
            <div
              className="font-mono text-sm bg-[#0D0D14] border border-[#2A2A3A] rounded-lg p-3 overflow-auto min-h-[360px] whitespace-pre leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlight(output) }}
            />
          ) : (
            <div className="font-mono text-sm bg-[#0D0D14] border border-[#2A2A3A] rounded-lg p-3 min-h-[360px] flex items-center justify-center text-[#3A3A4A]">
              Formatted output will appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
