# Agentin — Improvements Plan & Phase 5 Roadmap

> Updated: 2026-03-12 | Current: v3.1.0 | main = 7b53142

---

## ✅ Shipped (Phases 1–4 + Bug Fix Run)

| Feature | Status | Notes |
|---------|--------|-------|
| 9 AI personalities (Weebo/Edith/Jarvis/Aria/Forge/Pulse/Echo/Cal/Nova) | ✅ | Named routing: @Nova, hey Aria |
| 17 ReAct tools (notes, habits, reminders, expenses, focus, briefings…) | ✅ | hasToolTrigger gates |
| Hinglish routing + Indian merchant auto-categories | ✅ | hinglishToEnglish() |
| Habit Intelligence V2 (streaks, nudges, /habits V2) | ✅ | 11:00 IST nudge |
| Proactive Engine V3 (30-min preview, habit idle nudge) | ✅ | Redis dedup |
| Multi-Agent Orchestrator (launch mode → 3 parallel) | ✅ | 6 credits |
| Telegram Inline Keyboards (Done/Snooze/Delete) | ✅ | callback_query |
| Telegram File Handling (photo vision, doc extraction) | ✅ | Groq vision |
| Expense Tracker (track + budget + alerts) | ✅ | 90% alert |
| Smart Reminders V2 (recurrence detection) | ✅ | daily/weekly/monthly |
| Global Search (/search) | ✅ | across all data |
| Voice Notes (Whisper STT + edge-tts TTS) | ✅ | multilingual |
| Web Research (Tavily + crawl4ai + screenshot) | ✅ | fast-paths |
| Google/GitHub OAuth | ✅ | JWT-only |
| Domain migration → ai.agentin.chat | ✅ | |
| 6-tier LLM waterfall | ✅ | Ollama→Groq→Kimi→Together→Edith→OR |
| Brand purge (zero GeekSpace/PicoClaw refs) | ✅ | |
| Context preservation (16K window, no drop-all) | ✅ | 2026-03-12 |
| Notes full content in reply | ✅ | 2026-03-12 |

---

## 🔲 Phase 5 — Next Up

### P0 — Critical Gaps
1. **Health Monitor Telegram Alerts**
   - No alert sent when any component (DB, Ollama, Redis) goes down
   - Fix: wire health monitor state transitions to `sendTelegramNotification` for admin users

2. **Conversation Context Quality**
   - Monitor 16K budget; consider per-message cap (e.g. 3000-char max per stored assistant message)
   - Prevents runaway long messages from consuming entire context window

### P1 — High Value
3. **Voice Intelligence V2**
   - Multi-language TTS response routing (reply in the language the user spoke)
   - Voice reminders — send OGG voice message as reminder delivery via Telegram
   - Language detection: Hindi → Hindi TTS, English → English TTS

4. **Smart Scheduling**
   - When user sets a reminder, check Google Calendar for conflicts
   - Suggest alternative slots if conflict detected
   - "You have a meeting at 3pm, want to set it for 3:30pm instead?"

5. **AI Email Composer**
   - "Draft email to my manager about the project delay"
   - Bullet → professional email via Resend
   - Preview + send confirmation flow

6. **Smart Search UI (Ctrl+K)**
   - Dashboard Ctrl+K modal: search across all data in real-time
   - Keyboard-first: navigate results with arrows, Enter to open
   - Filters: notes / reminders / habits / memories / conversations

7. **Onboarding Hardening**
   - Prevent in-progress onboarding session blocking established Telegram users
   - Edge case: user with `onboarding_completed=0` blocks all future messages

### P2 — Nice to Have
8. **Seedance Director Mode**
   - Add FAL_KEY to .env
   - Test fal.ai video generation end-to-end
   - generate_video_story tool → actual video via fal.ai

9. **Memory Graph V2**
   - Semantic entity linking in user memories
   - "Remember that I like Python" + "Remember I work at Google" → entity graph

10. **WhatsApp Integration**
    - Current: stub only (marks DB, no real messages)
    - Needs: WhatsApp Business API or Twilio integration

---

## 🔮 Future Phases (P3+)

| Feature | Why |
|---------|-----|
| Video Pollinations | Blocked from VPS (needs proxy or fal.ai) |
| Smart Scheduling V2 | Calendar conflict matrix with multi-user awareness |
| AI Code Review in dashboard | PR review via GitHub API |
| PDF report generation | Export notes/habits/expenses as PDF |
| Mobile app (PWA push) | Native push notifications on mobile |
| n8n/Zapier webhooks | Real automation trigger marketplace |
| Social direct APIs | Real Twitter/LinkedIn posting (current: stub) |
| Windmill integration | WINDMILL_TOKEN missing, blocked |
