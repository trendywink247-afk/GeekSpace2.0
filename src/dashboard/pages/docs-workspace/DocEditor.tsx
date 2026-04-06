// ============================================================
// DocEditor — full-screen inline document editor with AI toolbar
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight, Sparkles, Maximize2, Minimize2, Globe, RefreshCw, Check,
  Loader2, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';
import { agentService, memoryService } from '@/services/api';
import type { ConversationEntry } from '@/types';
import { type Doc, type AIAction, AI_ACTION_PROMPTS } from './helpers';

// Opaque editor instance type — BlockNote typings are resolved at runtime
type BlockNoteEditorInstance = ReturnType<typeof Object.create>;

interface DocEditorProps {
  doc: Doc;
  onBack: () => void;
  onSaved: (msg: string) => void;
  onSaveFailed: (msg: string) => void;
}

export function DocEditor({ doc, onBack, onSaved, onSaveFailed }: DocEditorProps) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<unknown[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiProcessing, setAiProcessing] = useState<AIAction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convProcessing, setConvProcessing] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<BlockNoteEditorInstance>(null);

  // Load document content
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{ doc: Doc & { content: string } }>(`/docs/${doc.id}`);
        setTitle(res.data.doc.title);
        try {
          setContent(JSON.parse(res.data.doc.content) as unknown[]);
        } catch {
          setContent([]);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [doc.id]);

  const debouncedSave = useCallback((newContent: unknown[], newTitle?: string) => {
    clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.put(`/docs/${doc.id}`, {
          content: JSON.stringify(newContent),
          title: newTitle ?? title,
        });
        setSaveStatus('saved');
        onSaved('Document saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
        onSaveFailed('Document save failed');
      }
    }, 800);
  }, [doc.id, title, onSaved, onSaveFailed]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(content, newTitle);
  };

  /** Get text to process: selected text first, or full document markdown */
  const getTextForAI = (): { text: string; hasSelection: boolean } => {
    const editor = editorRef.current;
    if (!editor) return { text: '', hasSelection: false };
    const selectedText = (editor.getSelectedText?.() as string | undefined)?.trim();
    if (selectedText && selectedText.length > 0) {
      return { text: selectedText, hasSelection: true };
    }
    const markdown = editor.blocksToMarkdownLossy?.(editor.document) as string | undefined;
    return { text: markdown || '', hasSelection: false };
  };

  /** Replace selected blocks or full document with AI result */
  const applyAIResult = (resultText: string, hadSelection: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const newBlocks = editor.tryParseMarkdownToBlocks(resultText) as { id: string }[];
      if (!newBlocks || newBlocks.length === 0) return;

      if (hadSelection) {
        const selection = editor.getSelection?.() as { blocks?: { id: string }[] } | undefined;
        if (selection?.blocks && selection.blocks.length > 0) {
          editor.replaceBlocks(selection.blocks.map((b: { id: string }) => b.id), newBlocks);
        } else {
          const cursor = editor.getTextCursorPosition?.() as { block?: { id: string } } | undefined;
          if (cursor?.block) {
            editor.replaceBlocks([cursor.block.id], newBlocks);
          }
        }
      } else {
        const allBlockIds = (editor.document as { id: string }[]).map(b => b.id);
        if (allBlockIds.length > 0) {
          editor.replaceBlocks(allBlockIds, newBlocks);
        }
      }

      const updatedContent = editor.document as unknown[];
      setContent(updatedContent);
      debouncedSave(updatedContent);
    } catch {
      // ignore apply errors
    }
  };

  const handleAIAction = async (action: AIAction) => {
    const { text, hasSelection } = getTextForAI();
    if (!text) {
      setAiError('No text to process. Write something first.');
      setTimeout(() => setAiError(null), 3000);
      return;
    }
    setAiProcessing(action);
    setAiError(null);
    try {
      const res = await agentService.chat(AI_ACTION_PROMPTS[action](text), 'web');
      if (res.data.text) applyAIResult(res.data.text, hasSelection);
    } catch {
      setAiError('AI action failed. Please try again.');
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setAiProcessing(null);
    }
  };

  /** Load conversations for the "Create from Conversation" modal */
  const openConversationModal = async () => {
    setConvModalOpen(true);
    setConvLoading(true);
    try {
      const res = await memoryService.conversations(30);
      setConversations(Array.isArray(res.data) ? (res.data as ConversationEntry[]) : []);
    } catch {
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  };

  const createFromConversation = async (conv: ConversationEntry) => {
    setConvProcessing(conv.id);
    try {
      const prompt = `Create a well-structured document from this conversation content. Use proper headings, bullet points, and formatting. Return ONLY the document content in markdown:\n\n${conv.content}`;
      const res = await agentService.chat(prompt, 'web');
      const reply = res.data.text;
      if (reply && editorRef.current) {
        const newBlocks = editorRef.current.tryParseMarkdownToBlocks(reply) as { id: string }[];
        if (newBlocks?.length > 0) {
          const allBlockIds = (editorRef.current.document as { id: string }[]).map(b => b.id);
          if (allBlockIds.length > 0) {
            editorRef.current.replaceBlocks(allBlockIds, newBlocks);
          }
          const updatedContent = editorRef.current.document as unknown[];
          setContent(updatedContent);
          debouncedSave(updatedContent);
        }
      }
      setConvModalOpen(false);
    } catch {
      setAiError('Failed to create document from conversation.');
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setConvProcessing(null);
    }
  };

  const aiActions: { id: AIAction; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { id: 'improve',   icon: Sparkles,  label: 'Improve'     },
    { id: 'expand',    icon: Maximize2, label: 'Expand'      },
    { id: 'summarize', icon: Minimize2, label: 'Summarize'   },
    { id: 'translate', icon: Globe,     label: 'Translate'   },
    { id: 'rephrase',  icon: RefreshCw, label: 'Rephrase'    },
    { id: 'fix',       icon: Check,     label: 'Fix Grammar' },
  ];

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-64px)]">
      {/* ── Editor header ──────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 md:px-6 py-3
                         bg-[var(--ag-bg-surface)]/95 backdrop-blur-xl border-b border-[var(--ag-border-subtle)]">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/5 min-w-[44px] min-h-[44px]
                     flex items-center justify-center transition-[transform,background-color] active:scale-[0.96]"
          aria-label="Back to documents"
        >
          <ChevronRight className="w-4 h-4 rotate-180 text-[var(--ag-text-secondary)]" />
        </button>

        <input
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent font-heading font-semibold text-lg text-[var(--ag-text-primary)]
                     outline-none placeholder-[var(--ag-text-muted)]"
          placeholder="Untitled"
        />

        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--ag-amber)] shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-amber)] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-amber)]" />
          </span>
          Forge
        </span>

        <span className="text-xs text-[var(--ag-text-secondary)]">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>

        <Button
          size="sm"
          onClick={openConversationModal}
          className="gap-1.5 bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90 text-white min-h-[44px] shadow-lg transition-[transform,opacity,box-shadow] active:scale-[0.96]"
          title="Create from Conversation"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">From Chat</span>
        </Button>
      </header>

      {/* ── AI Writing Toolbar ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] overflow-x-auto scrollbar-hide">
        <span className="text-[10px] text-[var(--ag-text-secondary)]/60 uppercase tracking-wider mr-1 shrink-0">AI</span>
        {aiActions.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleAIAction(id)}
            disabled={!!aiProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                       text-[var(--ag-text-secondary)] hover:text-[var(--ag-amber)] hover:bg-[var(--ag-amber)]/10
                       transition-[transform,background-color,color] whitespace-nowrap disabled:opacity-50
                       active:scale-[0.96] min-h-[44px]"
          >
            {aiProcessing === id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ag-amber)]" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {label}
          </button>
        ))}
        {aiProcessing && (
          <span className="text-[10px] text-[var(--ag-amber)] animate-pulse ml-auto shrink-0">
            Processing...
          </span>
        )}
        {aiError && (
          <span className="text-[10px] text-red-400 ml-auto shrink-0">{aiError}</span>
        )}
      </div>

      {/* ── BlockNote Editor ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 md:pb-6">
        <BlockNoteEditorWrapper
          initialContent={content}
          onChange={blocks => {
            setContent(blocks);
            debouncedSave(blocks);
          }}
          onEditorReady={editor => { editorRef.current = editor; }}
        />
      </div>

      {/* ── Create from Conversation Modal ──────────────────── */}
      <Dialog open={convModalOpen} onOpenChange={setConvModalOpen}>
        <DialogContent className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[var(--ag-text-primary)] font-heading flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[var(--ag-violet)]" />
              Create from Conversation
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[var(--ag-text-secondary)] -mt-1">
            Select a conversation to generate a structured document from it.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2 mt-2 min-h-0">
            {convLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--ag-violet)]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-[var(--ag-text-secondary)]/60 text-center py-8">
                No conversations found
              </p>
            ) : (
              conversations
                .filter(c => c.content && c.content.trim().length > 20)
                .slice(0, 20)
                .map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => createFromConversation(conv)}
                    disabled={!!convProcessing}
                    className="w-full text-left p-3 rounded-xl border border-[var(--ag-border-subtle)]
                               hover:border-[var(--ag-border-subtle)]/50 hover:bg-[var(--ag-violet)]/5
                               transition-[transform,background-color,border-color] active:scale-[0.98] disabled:opacity-50 min-h-[44px] backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="text-[10px] px-1.5 py-0 bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border-[var(--ag-violet)]/20">
                        {conv.role}
                      </Badge>
                      {convProcessing === conv.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ag-violet)]" />
                      )}
                      <span className="text-[10px] text-[var(--ag-text-secondary)]/50">
                        {new Date(conv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--ag-text-primary)] line-clamp-2">{conv.content}</p>
                    {conv.summary && (
                      <p className="text-xs text-[var(--ag-text-secondary)] mt-1 line-clamp-1">{conv.summary}</p>
                    )}
                  </button>
                ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvModalOpen(false)} className="min-h-[44px]">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── BlockNote Editor lazy wrapper ─────────────────────────── */

function BlockNoteEditorWrapper({
  initialContent,
  onChange,
  onEditorReady,
}: {
  initialContent: unknown[];
  onChange: (blocks: unknown[]) => void;
  onEditorReady?: (editor: BlockNoteEditorInstance) => void;
}) {
  const [Editor, setEditor] = useState<React.ComponentType<{
    initialContent: unknown[];
    onChange: (blocks: unknown[]) => void;
    onEditorReady?: (editor: BlockNoteEditorInstance) => void;
  }> | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadEditor = async () => {
      try {
        const [{ useCreateBlockNote }, { BlockNoteView }] = await Promise.all([
          import('@blocknote/react'),
          import('@blocknote/mantine'),
        ]);
        await import('@blocknote/core/fonts/inter.css');
        await import('@blocknote/mantine/style.css');

        const BNEditor = ({ initialContent: init, onChange: onCh, onEditorReady: onReady }: {
          initialContent: unknown[];
          onChange: (blocks: unknown[]) => void;
          onEditorReady?: (editor: BlockNoteEditorInstance) => void;
        }) => {
          const editor = useCreateBlockNote({
            initialContent: init?.length > 0 ? (init as never[]) : undefined,
          });

          useEffect(() => {
            if (onReady) onReady(editor);
          }, [editor, onReady]);

          return (
            <div className="bn-dark-theme">
              <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={() => { onCh(editor.document as unknown[]); }}
              />
            </div>
          );
        };

        if (mounted) setEditor(() => BNEditor);
      } catch {
        // ignore load errors
      }
    };
    loadEditor();
    return () => { mounted = false; };
  }, []);

  if (!Editor) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--ag-text-secondary)] text-sm animate-pulse">Loading editor...</div>
      </div>
    );
  }

  return <Editor initialContent={initialContent} onChange={onChange} onEditorReady={onEditorReady} />;
}
