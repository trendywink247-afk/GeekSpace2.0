import { Brain, Tag, Clock, Trash2, Loader2, Download, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MemoryEntry, ConversationEntry } from '@/types';
import { agentService } from '@/services/api';

interface MemoryTabProps {
  memories: MemoryEntry[];
  memoryFilter: string;
  setMemoryFilter: (f: string) => void;
  memoriesLoading: boolean;
  reactionSummary: { reaction: string; count: number }[];
  starredMessages: ConversationEntry[];
  setStarredMessages: (msgs: ConversationEntry[]) => void;
  showStarred: boolean;
  setShowStarred: (v: boolean) => void;
  handleDeleteMemory: (id: string) => void;
  isExportingConversations: boolean;
  handleExportConversations: () => void;
  isExportingMarkdown: boolean;
  handleExportMarkdown: () => void;
  isExportingMarkdown7Days: boolean;
  handleExportMarkdown7Days: () => void;
}

const FILTER_OPTIONS = ['all', 'fact', 'preference'];

export function MemoryTab({
  memories,
  memoryFilter,
  setMemoryFilter,
  memoriesLoading,
  reactionSummary,
  starredMessages,
  setStarredMessages,
  showStarred,
  setShowStarred,
  handleDeleteMemory,
  isExportingConversations,
  handleExportConversations,
  isExportingMarkdown,
  handleExportMarkdown,
  isExportingMarkdown7Days,
  handleExportMarkdown7Days,
}: MemoryTabProps) {
  return (
    <div className="space-y-6">
      {/* Agent Memory list */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agent Memory</CardTitle>
              <CardDescription className="text-[var(--ag-text-muted)]">
                What your AI assistant remembers about you
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {FILTER_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMemoryFilter(cat)}
                  className={`px-3 py-2 min-h-[44px] rounded-lg text-xs capitalize transition-all ${
                    memoryFilter === cat
                      ? 'bg-[#A78BFA]/20 border border-[var(--ag-cyan)] text-[var(--ag-cyan)]'
                      : 'bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 text-[var(--ag-text-muted)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {memoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--ag-cyan)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-10 h-10 text-[var(--ag-cyan)]/30 mx-auto mb-3" />
              <p className="text-[var(--ag-text-muted)] mb-2">No memories yet</p>
              <p className="text-sm text-[var(--ag-text-muted)]">
                Your agent learns about you through conversations
              </p>
            </div>
          ) : (
            memories.map((memory) => (
              <div
                key={memory.id}
                className="flex items-start justify-between p-4 rounded-xl border border-[var(--ag-cyan)]/20 group hover:border-[var(--ag-cyan)]/40 transition-all"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: memory.category === 'fact' ? '#00FF8815' : '#A78BFA15' }}
                  >
                    <Tag
                      className="w-4 h-4"
                      style={{ color: memory.category === 'fact' ? '#00FF88' : '#A78BFA' }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--ag-text-primary)]">
                        {memory.key}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs border-[var(--ag-cyan)]/30 text-[var(--ag-text-muted)]"
                      >
                        {memory.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--ag-text-muted)]">{memory.value}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--ag-text-muted)]/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(memory.updatedAt || memory.createdAt).toLocaleDateString()}
                      </span>
                      <span>Confidence: {Math.round(memory.confidence * 100)}%</span>
                      <span>Source: {memory.source}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="text-[#FF6161] hover:text-[#FF6161] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Top reactions */}
      {reactionSummary.length > 0 && (
        <Card className="border-[var(--ag-cyan)]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-base">✨</span> Top Reactions
            </CardTitle>
            <CardDescription className="text-[var(--ag-text-muted)] text-xs">
              Your most-used reactions on agent messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {reactionSummary.map(({ reaction, count }) => (
                <div
                  key={reaction}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/20 hover:border-[var(--ag-cyan)]/40 transition-colors"
                >
                  <span className="text-base leading-none">{reaction}</span>
                  <span className="text-xs font-bold text-[var(--ag-cyan)]">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Starred messages */}
      <Card className="border-[#F59E0B]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-base">⭐</span> Starred Messages
              {starredMessages.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
                  {starredMessages.length}
                </span>
              )}
            </CardTitle>
            <button
              onClick={() => setShowStarred(!showStarred)}
              className="text-xs text-[var(--ag-text-muted)] hover:text-[#F59E0B] transition-colors"
            >
              {showStarred ? 'Hide' : 'Show'}
            </button>
          </div>
          <CardDescription className="text-[var(--ag-text-muted)] text-xs">
            Messages you&apos;ve starred from your conversation history
          </CardDescription>
        </CardHeader>
        {showStarred && (
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {starredMessages.length === 0 ? (
              <p className="text-xs text-[var(--ag-text-muted)] py-2">
                No starred messages yet. Star messages from your conversation history.
              </p>
            ) : (
              starredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[#F59E0B]/20"
                >
                  <span className="text-xs mt-0.5">{msg.role === 'user' ? '👤' : '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--ag-text-primary)] line-clamp-2">{msg.content}</p>
                    <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      agentService.toggleStar(msg.id).then(() => {
                        setStarredMessages(starredMessages.filter((m) => m.id !== msg.id));
                      }).catch(() => {});
                    }}
                    className="shrink-0 text-[#F59E0B] hover:text-[var(--ag-text-muted)] transition-colors"
                    title="Unstar"
                    data-testid={`unstar-msg-${msg.id}`}
                  >
                    ★
                  </button>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      {/* How memory works */}
      <Card className="bg-gradient-to-r from-[#A78BFA]/10 to-transparent border-[var(--ag-cyan)]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-[var(--ag-cyan)] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">How Memory Works</h4>
              <p className="text-xs text-[var(--ag-text-muted)]">
                Your agent learns about you through conversations — extracting facts, preferences,
                and context. Memories improve response quality over time. You can delete any memory
                at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat history export */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Chat History Export</h4>
              <p className="text-xs text-[var(--ag-text-muted)]">
                Download your full conversation history as a JSON file.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportConversations}
              disabled={isExportingConversations}
              className="border-[var(--ag-cyan)]/30 text-[var(--ag-cyan)] hover:bg-[#A78BFA]/10"
            >
              {isExportingConversations ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export as JSON
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Export as Markdown</h4>
              <p className="text-xs text-[var(--ag-text-muted)]">
                Download chat history as a readable Markdown (.md) file.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMarkdown7Days}
                disabled={isExportingMarkdown7Days}
                className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10"
              >
                {isExportingMarkdown7Days ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CalendarDays className="w-4 h-4 mr-2" />
                )}
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMarkdown}
                disabled={isExportingMarkdown}
                className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10"
              >
                {isExportingMarkdown ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                All time
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
