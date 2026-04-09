/* eslint-disable react-refresh/only-export-components */
// ============================================================
// Chat markdown renderer — extracted from AgentChatPanel.tsx
// ============================================================

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 42.3: CodeBlock — renders a fenced code block with a Copy button
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-[#A78BFA]/20">
      <div className="flex items-center justify-between px-3 py-1 bg-[#0A0A1A]">
        <span className="text-[10px] text-[var(--ag-text-muted)]">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)] hover:text-[var(--ag-cyan)] transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-[#00FF88]" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs text-[#E8E8F0] bg-[var(--ag-bg-deep)] leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// 42.3: Render message content with full markdown support
export function renderMessageContent(content: string): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with copy button
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          // Inline code
          if (!match && !codeStr.includes('\n')) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-[#1A1A2E] text-[var(--ag-cyan)] text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          // Fenced code block
          return <CodeBlock lang={match?.[1] || ''} code={codeStr} />;
        },
        // Paragraphs
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
        },
        // Bold
        strong({ children }) {
          return <strong className="font-semibold text-[var(--ag-text-primary)]">{children}</strong>;
        },
        // Links
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--ag-cyan)] hover:underline">
              {children}
            </a>
          );
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-sm">{children}</li>;
        },
        // Headings
        h1({ children }) {
          return <h1 className="text-lg font-bold text-[var(--ag-text-primary)] mb-2 mt-3">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-base font-bold text-[var(--ag-text-primary)] mb-1.5 mt-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] mb-1 mt-2">{children}</h3>;
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-[#A78BFA]/30 pl-3 my-2 text-[var(--ag-text-secondary)] italic">
              {children}
            </blockquote>
          );
        },
        // Table
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="px-3 py-1.5 text-left font-semibold text-[#E8E8F0] bg-[#1A1A2E] border border-white/10">{children}</th>;
        },
        td({ children }) {
          return <td className="px-3 py-1.5 text-[#C0C0D0] border border-white/10">{children}</td>;
        },
        // Horizontal rule
        hr() {
          return <hr className="border-white/10 my-3" />;
        },
        // Task list items
        input({ checked, ...props }) {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-1.5 rounded border-gray-600 text-[var(--ag-cyan)]"
              {...props}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
