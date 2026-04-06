import { useState } from 'react';
import { memoryService, userService } from '@/services/api';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export function useSettingsExports() {
  const [isExportingConversations, setIsExportingConversations] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);
  const [isExportingMarkdown7Days, setIsExportingMarkdown7Days] = useState(false);
  const [isExportingGDPR, setIsExportingGDPR] = useState(false);

  const handleExportConversations = async () => {
    setIsExportingConversations(true);
    try {
      const { data } = await memoryService.getConversationsExport(1000);
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        `agentin-conversations-${today()}.json`
      );
    } catch { /* silent */ } finally { setIsExportingConversations(false); }
  };

  const handleExportMarkdown7Days = async () => {
    setIsExportingMarkdown7Days(true);
    try {
      const { data } = await memoryService.getConversationsMarkdownExport7Days();
      downloadBlob(
        new Blob([data as unknown as string], { type: 'text/markdown' }),
        `agentin-chat-7days-${today()}.md`
      );
    } catch { /* silent */ } finally { setIsExportingMarkdown7Days(false); }
  };

  const handleExportMarkdown = async () => {
    setIsExportingMarkdown(true);
    try {
      const { data } = await memoryService.getConversationsMarkdownExport();
      downloadBlob(
        new Blob([data as unknown as string], { type: 'text/markdown' }),
        `agentin-chat-${today()}.md`
      );
    } catch { /* silent */ } finally { setIsExportingMarkdown(false); }
  };

  const handleGDPRExport = async () => {
    setIsExportingGDPR(true);
    try {
      const results = await Promise.allSettled([
        userService.getProfile(),
        memoryService.getConversationsExport(5000),
        memoryService.list(),
        userService.getSessions(),
      ]);
      const bundle = {
        exportedAt: new Date().toISOString(),
        format: 'GDPR Data Export - Agentin Chat',
        profile: results[0].status === 'fulfilled' ? results[0].value.data : null,
        conversations: results[1].status === 'fulfilled' ? results[1].value.data : [],
        memories: results[2].status === 'fulfilled' ? results[2].value.data : [],
        sessions: results[3].status === 'fulfilled' ? results[3].value.data.sessions : [],
      };
      downloadBlob(
        new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
        `agentin-gdpr-export-${today()}.json`
      );
    } catch { /* silent */ } finally { setIsExportingGDPR(false); }
  };

  return {
    isExportingConversations,
    isExportingMarkdown,
    isExportingMarkdown7Days,
    isExportingGDPR,
    handleExportConversations,
    handleExportMarkdown,
    handleExportMarkdown7Days,
    handleGDPRExport,
  };
}
