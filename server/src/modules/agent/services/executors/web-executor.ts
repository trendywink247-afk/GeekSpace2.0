/**
 * Web & search executor — web search, crawling, screenshots, URL extraction, monitoring.
 */

import { db } from '../../../../db/index.js';
import { logger } from '../../../../logger.js';
import { tavilySearch } from '../../../../services/tavily.js';
import { searxngSearch } from '../../../../services/searxng.js';
import { fetchAndExtract, fetchScreenshot, extractLinks, smartSearch } from '../../../../services/web-research.js';
import type { ActionResult } from '../action-executor.js';

export async function executeWebAction(
  userId: string,
  tool: string,
  params: Record<string, unknown>,
): Promise<ActionResult | null> {
  switch (tool) {
      case 'crawl_url':
      case 'web_fetch': {
        const url = params.url as string;
        try {
          const content = await fetchAndExtract(url);
          return {
            tool,
            success: true,
            message: `Fetched ${url} — ${content.length} chars`,
            // Use 'summary' key so react-loop injects full content (not 1000-char JSON truncation)
            data: { url, summary: content },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to fetch ${url}`,
          };
        }
      }

      // ── trigger_workflow ──────────────────────────────────
      case 'web_search': {
        const query = params.query as string;
        const maxResults = (params.max_results as number) || 3;

        // If query contains a URL or bare domain and Tavily key missing → use crawl4ai directly
        const explicitUrlMatch = query.match(/https?:\/\/\S+/);
        const bareDomainMatch = !explicitUrlMatch && query.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/);
        const crawlTarget = explicitUrlMatch ? explicitUrlMatch[0] : (bareDomainMatch ? `https://${bareDomainMatch[1]}` : null);
        if (!process.env.TAVILY_API_KEY && crawlTarget) {
          try {
            const content = await fetchAndExtract(crawlTarget);
            return {
              tool,
              success: true,
              message: `Fetched ${crawlTarget} — ${content.length} chars`,
              data: { query, results: [], summary: content, url: crawlTarget },
            };
          } catch (err) {
            return {
              tool,
              success: false,
              message: err instanceof Error ? err.message : `Failed to fetch ${crawlTarget}`,
            };
          }
        }

        // Try SearXNG first (free, self-hosted, unlimited)
        let results: Awaited<ReturnType<typeof tavilySearch>>['results'] = [];
        try {
          const searxResult = await searxngSearch(query, maxResults);
          results = searxResult.results;
        } catch {
          // SearXNG failed, try Tavily fallback
        }

        // Tavily fallback if SearXNG returned nothing
        if (results.length === 0 && process.env.TAVILY_API_KEY) {
          try {
            const searchResult = await tavilySearch(query, maxResults);
            results = searchResult.results;
          } catch { /* fall through */ }
        }

        // Smart search fallback (crawl4ai site-specific)
        if (results.length === 0) {
          try {
            const smartResult = await smartSearch(query);
            if (smartResult) {
              return {
                tool,
                success: true,
                message: `Found results via site search for "${query}"`,
                data: { query, results: [], summary: smartResult },
              };
            }
          } catch { /* fall through */ }
        }

        if (results.length === 0) {
          return {
            tool,
            success: false,
            message: `No search results found for "${query}". Try rephrasing your query.`,
          };
        }

        if (results.length === 0) {
          return {
            tool,
            success: false,
            message: `No results found for "${query}".`,
          };
        }

        const summary = results
          .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`)
          .join('\n\n');

        return {
          tool,
          success: true,
          message: `Found ${results.length} results for "${query}"`,
          data: { query, results, summary },
        };
      }

      // ── take_screenshot ──────────────────────────────────────
      case 'take_screenshot': {
        const rawUrl = params.url as string;
        const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        try {
          const base64Png = await fetchScreenshot(targetUrl);
          const dataUrl = `data:image/png;base64,${base64Png}`;
          logger.info({ url: targetUrl }, 'take_screenshot: success');
          return {
            tool,
            success: true,
            message: `Screenshot captured for ${targetUrl}`,
            imageUrl: dataUrl,
            data: { url: targetUrl },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to screenshot ${targetUrl}`,
          };
        }
      }

      // ── get_links ────────────────────────────────────────────
      case 'get_links': {
        const rawUrl = params.url as string;
        const filter = (params.filter as 'internal' | 'external' | 'all') || 'all';
        const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        try {
          const links = await extractLinks(targetUrl, filter);
          if (links.length === 0) {
            return { tool, success: true, message: `No ${filter} links found on ${targetUrl}`, data: { links: [] } };
          }
          const formatted = links.slice(0, 50)
            .map((l, i) => `${i + 1}. [${l.text.slice(0, 80)}](${l.href}) (${l.type})`)
            .join('\n');
          return {
            tool,
            success: true,
            message: `Found ${links.length} ${filter} links on ${targetUrl}`,
            data: { links: links.slice(0, 50), summary: formatted, total: links.length },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to extract links from ${targetUrl}`,
          };
        }
      }

      // ── send_telegram ────────────────────────────────────────
      case 'youtube_summarize': {
        const url = params.url as string;
        try {
          const content = await fetchAndExtract(url);
          const { routeChat } = await import('../llm.js');
          const sysPrompt = 'You are a helpful assistant. Summarize YouTube video content concisely.';
          const userContent = `Summarize this YouTube video content:\nURL: ${url}\n\nExtracted content:\n${content.slice(0, 4000)}\n\nProvide: main topic, key points (5 bullets), and key takeaways.`;
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 120 },
          );
          return { tool, success: true, message: result.reply, data: { url } };
        } catch (err) {
          return { tool, success: false, message: `YouTube summarize failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── get_briefing ─────────────────────────────────────────
      case 'summarize_url': {
        const url = (params.url as string).trim();
        const format = (params.format as string) || 'bullets';
        const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        try {
          const content = await fetchAndExtract(targetUrl);
          const { routeChat } = await import('../llm.js');
          const formatInstructions = {
            bullets: 'Summarize as 5-7 bullet points. Be concise.',
            paragraph: 'Summarize in 2-3 short paragraphs.',
            tldr: 'Give a 1-2 sentence TL;DR summary.',
          }[format] || 'Summarize as bullet points.';
          const sysPrompt = 'You are a helpful assistant that summarizes web content accurately and concisely.';
          const userContent = `${formatInstructions}\n\nURL: ${targetUrl}\nContent:\n${content.slice(0, 4000)}`;
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 100 },
          );
          return { tool, success: true, message: result.reply, data: { url: targetUrl, format } };
        } catch (err) {
          return { tool, success: false, message: `URL summarize failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── Expense Tracker ──────────────────────────────────────────────────

      case 'browse_and_extract': {
        const browseUrl = params.url as string;
        if (!browseUrl) return { tool, success: false, message: 'Please provide a URL to browse.' };
        try {
          const { navigatePage } = await import('../../../../services/browser-agent.js');
          const result = await navigatePage(browseUrl);
          if (result.error) return { tool, success: false, message: `Browser error: ${result.error}` };
          return {
            tool, success: true,
            message: `**${result.title || browseUrl}**\n\n${(result.text || '').slice(0, 3000)}`,
            data: { url: result.url, linksCount: result.links?.length || 0 },
          };
        } catch {
          return { tool, success: false, message: 'Browser agent is not available.' };
        }
      }

      // ── check_page_status ──────────────────────────────────────
      case 'check_page_status': {
        const checkUrl = params.url as string;
        if (!checkUrl) return { tool, success: false, message: 'Please provide a URL to check.' };
        try {
          const { extractPageContent } = await import('../../../../services/browser-agent.js');
          const result = await extractPageContent(checkUrl);
          if (result.error) return { tool, success: true, message: `${checkUrl} — Error: ${result.error}` };
          return { tool, success: true, message: `✅ ${checkUrl} is live\nTitle: ${result.title}` };
        } catch {
          return { tool, success: true, message: `❓ Could not reach ${checkUrl} — browser agent unavailable.` };
        }
      }

      // ── monitor_page_change ────────────────────────────────────
      case 'monitor_page_change': {
        const monUrl = params.url as string;
        const checkFor = (params.check_for as string) || '';
        const freqHours = (params.frequency_hours as number) || 24;
        if (!monUrl) return { tool, success: false, message: 'Please provide a URL to monitor.' };

        const { v4: monUuid } = await import('uuid');
        const monId = monUuid();
        db.prepare(`
          INSERT INTO page_monitors (id, user_id, url, check_for, frequency_hours, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(monId, userId, monUrl, checkFor, freqHours, Date.now());

        return {
          tool, success: true,
          message: `\u{1F441}\uFE0F Now monitoring: ${monUrl}\nChecking every ${freqHours}h${checkFor ? ` for: "${checkFor}"` : ''}\nI'll alert you when something changes.`,
          data: { monitorId: monId },
        };
      }

      // ── stop_monitoring ──────────────────────────────────────────
      case 'stop_monitoring': {
        const monUrl = params.url as string;
        if (monUrl) {
          db.prepare("UPDATE page_monitors SET enabled = 0 WHERE user_id = ? AND url LIKE ?").run(userId, `%${monUrl}%`);
        } else {
          db.prepare("UPDATE page_monitors SET enabled = 0 WHERE user_id = ?").run(userId);
        }
        return { tool, success: true, message: '\u2705 Page monitoring stopped.' };
      }

      // ── recall_entity ────────────────────────────────────────────

      default:
        return null;
    }
}
