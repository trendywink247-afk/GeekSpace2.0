/**
 * Content & Media executor — code generation, portfolio updates, image/video/avatar generation.
 */

import { db } from '../../../../db/index.js';
import { logger } from '../../../../logger.js';
import { config } from '../../../../config.js';
import { v4 as uuid } from 'uuid';
import { RECEIPT_TEMPLATES, type ReceiptItem } from '../../../../services/receipts.js';
import { cacheSet, cacheGet, cacheDel } from '../../../../services/cache.js';
import { generateImage, generateVideo, generateAvatar } from '../../../../services/media-generation.js';
import type { ActionResult } from '../action-executor.js';

// 48.2: Invalidate public portfolio cache after AI-driven portfolio writes
async function invalidatePortfolioCache(userId: string): Promise<void> {
  try {
    const row = db.prepare('SELECT username FROM portfolios WHERE user_id = ?').get(userId) as { username: string } | undefined;
    if (row?.username) await cacheDel(`portfolio:${row.username}`);
    const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    if (userRow?.username && userRow.username !== row?.username) await cacheDel(`portfolio:${userRow.username}`);
  } catch { /* non-fatal */ }
}

export async function executeContentMediaAction(
  userId: string,
  tool: string,
  params: Record<string, unknown>,
): Promise<ActionResult | null> {
  switch (tool) {
      // ── generate_code ───────────────────────────────────
      case 'generate_code': {
        let html = (params.html as string) || '';
        let css = (params.css as string) || '';
        let js = (params.js as string) || '';
        let title = params.title as string;

        const existingArtifactId = params.existingArtifactId as string | undefined;
        const baseUrl = params.baseUrl as string | undefined;

        // For edits: load stored template params and merge with LLM overrides
        // so e.g. "change theme to blue" doesn't lose name/profession/etc.
        let storedTemplateParams: Record<string, unknown> = {};
        let existingHtml: string | undefined;
        if (existingArtifactId && !html) {
          const existingArtifact = db.prepare(
            'SELECT html, metadata FROM generated_artifacts WHERE id = ? AND user_id = ?'
          ).get(existingArtifactId, userId) as { html: string; metadata: string } | undefined;
          if (existingArtifact) {
            existingHtml = existingArtifact.html || undefined;
            if (existingArtifact.metadata) {
              try { storedTemplateParams = JSON.parse(existingArtifact.metadata); } catch { /* ignore */ }
            }
          }
        }

        if (!html) {
          const userPrompt = params.prompt as string | undefined;

          if (userPrompt) {
            // ── Prompt-based path: LLM generates custom HTML from the user's actual request ──
            // Used for freeform requests like "hello world futuristic", "calculator app", "snake game".
            const { routeChat } = await import('../llm.js');
            const sysPrompt = [
              'You are an expert web developer. Generate a complete, self-contained HTML page.',
              'Rules:',
              '- Output ONLY valid HTML starting with <!DOCTYPE html> and ending with </html>.',
              '- Embed ALL CSS inside a <style> tag in <head>.',
              '- Embed ALL JavaScript inside a <script> tag before </body>.',
              '- Make it visually impressive and match the user\'s description exactly.',
              '- Do NOT output markdown, code fences, or any explanation — raw HTML only.',
            ].join('\n');
            try {
              // When editing an existing custom artifact, pass the existing HTML so the
              // LLM can modify it rather than generate a new page from scratch.
              const userContent = existingHtml
                ? `Here is the existing webpage code:\n\`\`\`html\n${existingHtml.slice(0, 8000)}\n\`\`\`\n\nThe user wants to change: ${userPrompt}\n\nReturn the complete updated HTML with the requested changes applied. Keep all existing functionality intact.`
                : `Build this website: ${userPrompt}`;
              const llmResult = await routeChat(
                [{ role: 'user', content: userContent }],
                { systemPrompt: sysPrompt, userCredits: 200 },
              );
              // Strip markdown code fences if the model wrapped the output
              const raw = llmResult.reply.trim()
                .replace(/^```(?:html)?\r?\n?/i, '')
                .replace(/\r?\n?```$/i, '');
              html = (raw.startsWith('<!') || raw.toLowerCase().startsWith('<html'))
                ? raw
                : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${userPrompt.slice(0, 60)}</title><style>body{margin:0;font-family:sans-serif}</style></head><body>${raw}</body></html>`;
              title = title || userPrompt.slice(0, 60);
              css = '';
              js = '';
            } catch (err) {
              logger.warn({ err }, 'generate_code LLM generation failed, falling back to template');
              // Fall through to template render below
            }
          }

          // ── Template-based path: structured params → pre-built site template ──
          // Used when LLM provides structured params (name/theme/template) for personal pages.
          if (!html) {
            const merged = { ...storedTemplateParams, ...params };
            const { renderWebsiteTemplate } = await import('../../../../services/website-templates.js');
            const rendered = renderWebsiteTemplate({
              template: (merged.template as 'portfolio' | 'landing' | 'blog' | 'business') || 'portfolio',
              title: merged.title as string | undefined,
              name: merged.name as string | undefined,
              theme: merged.theme as 'dark' | 'light' | 'purple' | 'blue' | 'gradient' | undefined,
              profession: merged.profession as string | undefined,
              location: merged.location as string | undefined,
              bio: merged.bio as string | undefined,
              skills: merged.skills as string[] | undefined,
              email: merged.email as string | undefined,
              tagline: merged.tagline as string | undefined,
              productName: merged.productName as string | undefined,
              description: merged.description as string | undefined,
              features: merged.features as string[] | undefined,
              cta: merged.cta as string | undefined,
            });
            html = rendered.html;
            css = rendered.css;
            js = rendered.js;
            title = title || rendered.title;
            storedTemplateParams = merged;
          }
        }

        const selfDestruct = params.selfDestruct as boolean | undefined;
        const templateMetadata = JSON.stringify(storedTemplateParams);

        // Check if we should update an existing artifact (builder "edit" flow)
        if (existingArtifactId) {
          const existing = db.prepare(
            'SELECT id FROM generated_artifacts WHERE id = ? AND user_id = ?'
          ).get(existingArtifactId, userId) as { id: string } | undefined;

          if (existing) {
            db.prepare(
              `UPDATE generated_artifacts SET title = ?, html = ?, css = ?, js = ?, metadata = ? WHERE id = ? AND user_id = ?`
            ).run(title, html, css, js, templateMetadata, existingArtifactId, userId);

            const previewUrl = baseUrl ? `${baseUrl}/preview/${userId}/${existingArtifactId}` : undefined;
            return {
              tool,
              success: true,
              message: `Updated project "${title}"${previewUrl ? `. Live preview: ${previewUrl}` : ''}`,
              artifactId: existingArtifactId,
              previewUrl,
              data: { title, html, css, js, previewUrl, updated: true },
              receipt: previewUrl
                ? RECEIPT_TEMPLATES.website(title, previewUrl)
                : RECEIPT_TEMPLATES.project(title),
            };
          }
          // Fall through to create new if existing artifact not found
        }

        const id = uuid();

        // Calculate expiration (48 hours only if explicitly self-destruct, otherwise permanent)
        const expiresAt = selfDestruct === true
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : null;

        db.prepare(
          `INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, metadata, expires_at)
           VALUES (?, ?, 'code', ?, ?, ?, ?, ?, ?)`,
        ).run(id, userId, title, html, css, js, templateMetadata, expiresAt);

        // Build preview URL if baseUrl provided
        const previewUrl = baseUrl ? `${baseUrl}/preview/${userId}/${id}` : undefined;

        // Auto-add to portfolio projects so user sees it in their dashboard
        try {
          const portfolio = db.prepare('SELECT projects FROM portfolios WHERE user_id = ?').get(userId) as { projects: string } | undefined;
          if (portfolio) {
            const projects = JSON.parse(portfolio.projects || '[]') as unknown[];
            projects.push({
              id: uuid(),
              name: title,
              description: 'Generated by AI assistant',
              tags: ['generated', 'ai'],
              liveUrl: previewUrl || '',
              repoUrl: '',
            });
            db.prepare('UPDATE portfolios SET projects = ? WHERE user_id = ?')
              .run(JSON.stringify(projects), userId);
            await invalidatePortfolioCache(userId); // 48.2
          }
        } catch { /* non-fatal */ }

        const result: ActionResult = {
          tool,
          success: true,
          message: `Created project "${title}"${previewUrl ? `. Live preview: ${previewUrl}` : ''}`,
          artifactId: id,
          previewUrl,
          data: { title, html, css, js, previewUrl },
          receipt: previewUrl
            ? RECEIPT_TEMPLATES.website(title, previewUrl)
            : RECEIPT_TEMPLATES.project(title),
        };
        return result;
      }

      // ── portfolio_add_project ───────────────────────────
      case 'portfolio_add_project': {
        const row = db.prepare(
          `SELECT projects FROM portfolios WHERE user_id = ?`,
        ).get(userId) as { projects: string } | undefined;

        let projects: unknown[] = [];
        try { projects = row ? JSON.parse(row.projects) : []; } catch { projects = []; }

        projects.push({
          id: uuid(),
          name: params.title as string,
          description: (params.description as string) || '',
          tags: (params.tags as string[]) || [],
          liveUrl: (params.liveUrl as string) || '',
          repoUrl: (params.repoUrl as string) || '',
        });

        db.prepare(
          `UPDATE portfolios SET projects = ? WHERE user_id = ?`,
        ).run(JSON.stringify(projects), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: `Added project "${params.title}" to portfolio`,
          receipt: RECEIPT_TEMPLATES.project(params.title as string),
        };
      }

      // ── portfolio_update_bio ────────────────────────────
      case 'portfolio_update_bio': {
        db.prepare(
          `UPDATE portfolios SET about = ? WHERE user_id = ?`,
        ).run(params.bio as string, userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: 'Portfolio bio updated',
          receipt: RECEIPT_TEMPLATES.memory('Portfolio bio'),
        };
      }

      // ── portfolio_update_skills ─────────────────────────
      case 'portfolio_update_skills': {
        db.prepare(
          `UPDATE portfolios SET skills = ? WHERE user_id = ?`,
        ).run(JSON.stringify(params.skills as string[]), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: 'Portfolio skills updated',
          receipt: RECEIPT_TEMPLATES.memory('Portfolio skills'),
        };
      }

      // ── portfolio_remove_project ────────────────────────
      case 'portfolio_remove_project': {
        const row = db.prepare(
          `SELECT projects FROM portfolios WHERE user_id = ?`,
        ).get(userId) as { projects: string } | undefined;

        let projects: { name: string; [key: string]: unknown }[] = [];
        try { projects = row ? JSON.parse(row.projects) : []; } catch { projects = []; }

        const targetTitle = (params.projectTitle as string).toLowerCase();
        const filtered = projects.filter(
          (p) => p.name.toLowerCase() !== targetTitle,
        );

        if (filtered.length === projects.length) {
          return {
            tool,
            success: false,
            message: `Project "${params.projectTitle}" not found in portfolio`,
          };
        }

        db.prepare(
          `UPDATE portfolios SET projects = ? WHERE user_id = ?`,
        ).run(JSON.stringify(filtered), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: `Removed project "${params.projectTitle}" from portfolio`,
        };
      }

      // ── portfolio_update_theme ──────────────────────────
      case 'portfolio_update_theme': {
        const accentColor = params.accentColor as string | undefined;
        const mode = (params.mode as string | undefined) || 'dark';
        db.prepare(`UPDATE users SET theme_mode = ?, theme_accent = ? WHERE id = ?`)
          .run(mode, accentColor || '#7B61FF', userId);
        return {
          tool,
          success: true,
          message: `App theme updated${accentColor ? ` (accent: ${accentColor})` : ''}`,
        };
      }

      // ── send_email ──────────────────────────────────────
      case 'generate_image': {
        const prompt = params.prompt as string;
        const width = params.width as number | undefined;
        const height = params.height as number | undefined;

        // Look up user's preferred image model from agent_configs
        const agentCfg = db.prepare(
          'SELECT preferred_image_model FROM agent_configs WHERE user_id = ?'
        ).get(userId) as { preferred_image_model?: string } | undefined;
        const preferredModel = agentCfg?.preferred_image_model || 'auto';

        // Map preference to forceProvider
        const forceProvider: 'pollinations' | 'huggingface' | undefined =
          preferredModel === 'huggingface-flux' ? 'huggingface' :
          preferredModel === 'pollinations' ? 'pollinations' :
          undefined;

        const result = await generateImage(prompt, { width, height, forceProvider });

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Image generation failed: ${result.error}`,
          };
        }

        // Persist to user_images table so image appears in dashboard gallery
        const imageId = `img-${uuid().slice(0, 12)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        try {
          db.prepare(`
            INSERT INTO user_images (id, user_id, prompt, model, image_url, width, height, source, expires_at)
            VALUES (?, ?, ?, ?, ?, 1024, 1024, 'generated', ?)
          `).run(imageId, userId, prompt, 'huggingface-flux', result.url, expiresAt);
        } catch {
          // Non-fatal: gallery save failure doesn't break image delivery
        }

        return {
          tool,
          success: true,
          message: `Image generated successfully`,
          imageUrl: result.url,
          imageId,
          data: { url: result.url, prompt, imageId },
          receipt: RECEIPT_TEMPLATES.image(prompt),
        };
      }

      // ── generate_video ──────────────────────────────────────
      case 'generate_video': {
        const prompt = params.prompt as string;
        const duration = params.duration as number | undefined;

        const result = await generateVideo(prompt, { duration });

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Video generation failed: ${result.error}`,
          };
        }

        return {
          tool,
          success: true,
          message: `Video generation started. ETA: ~${result.estimatedTime}s`,
          videoUrl: result.url,
          data: { url: result.url, prompt, estimatedTime: result.estimatedTime },
        };
      }

      // ── generate_avatar ─────────────────────────────────────
      case 'generate_avatar': {
        const description = params.description as string;
        const style = (params.style as 'professional' | 'creative' | 'fun') || 'professional';

        const result = await generateAvatar(description, style);

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Avatar generation failed: ${result.error}`,
          };
        }

        // Save avatar to user profile
        db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(result.url, userId);

        return {
          tool,
          success: true,
          message: `Avatar generated and saved`,
          data: { url: result.url, style },
          receipt: RECEIPT_TEMPLATES.avatar(),
        };
      }

      // ── escalate_to_owner ──────────────────────────────────
      case 'generate_social_post': {
        const topic = params.topic as string;
        const platform = (params.platform as string) || 'twitter';
        const tone = (params.tone as string) || 'professional';
        const limits: Record<string, number> = { twitter: 280, linkedin: 3000, instagram: 2200, facebook: 63206 };
        const charLimit = limits[platform] || 280;
        const { routeChat } = await import('../llm.js');
        const sysPrompt = `You are a social media expert. Write engaging ${platform} posts. Be ${tone}. Stay under ${charLimit} characters.`;
        const userContent = `Write a ${tone} ${platform} post about: ${topic}\n\nInclude relevant hashtags. No markdown formatting — plain text only.`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 80 },
          );
          return { tool, success: true, message: result.reply, data: { topic, platform, tone } };
        } catch (err) {
          return { tool, success: false, message: `Social post generation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── create_automation ────────────────────────────────────
      case 'generate_video_story': {
        const topic = params.topic as string;
        const style = (params.style as string) || 'cinematic';
        const durationSec = (params.duration_sec as number) || 60;
        const { routeChat } = await import('../llm.js');
        const sysPrompt = 'You are a professional screenwriter and video director. Write compelling video scripts.';
        const userContent = `Write a ${style} video story script about: ${topic}\nTarget duration: ${durationSec} seconds\n\nFormat:\n- TITLE\n- HOOK (opening 5 seconds)\n- ACT 1, 2, 3 (with scene descriptions and dialogue/narration)\n- CTA (call to action)\n- VISUAL NOTES`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 150 },
          );
          // Save to notes
          db.prepare(`
            INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
          `).run(userId, `Video Story: ${topic}`, result.reply, JSON.stringify(['video', 'script', style]));
          return { tool, success: true, message: result.reply, data: { topic, style, durationSec } };
        } catch (err) {
          return { tool, success: false, message: `Video story generation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── summarize_url ────────────────────────────────────────

      default:
        return null;
    }
}
