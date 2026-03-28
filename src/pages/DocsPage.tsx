import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Rocket, Bot, Zap, Settings,
  Shield, HelpCircle, ChevronRight, ChevronDown, Search
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocArticle {
  title: string;
  summary: string;
  content: string;
}

interface DocSection {
  id: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  articles: DocArticle[];
}

// ---------------------------------------------------------------------------
// Article content — 18 real articles across 6 sections
// ---------------------------------------------------------------------------

const docs: DocSection[] = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    description: 'Set up your first agent, understand personalities, and connect Telegram',
    articles: [
      {
        title: 'Setting Up Your First Agent',
        summary: 'Create your account, configure your agent, and start chatting in under five minutes.',
        content: `Welcome to Agentin -- the self-hosted agentic AI platform built for Indian professionals. Getting started takes just a few steps and you will be chatting with your personal AI assistant within minutes.

Step 1: Create your account. Visit the Agentin login page and sign up using your email and password, or use Google Sign-In for a faster onboarding experience. Google Sign-In also enables Calendar and Gmail integrations automatically.

Step 2: Complete the onboarding wizard. After signing up, you will be guided through a short wizard that asks about your role (developer, designer, marketer, student, freelancer, etc.), your preferred use cases (productivity, coding help, content creation, financial tracking), and how you want your agent to communicate.

Step 3: Name your agent. Choose a name that feels natural to you. The default agents are Weebo (creative and friendly), Jarvis (precise and professional), and Edith (analytical and thorough). Each comes with a distinct personality that shapes how they respond.

Step 4: Choose your plan. Agentin offers a generous free tier that includes 50 AI messages per day, basic reminders, habit tracking, and a single agent. The Pro plan unlocks unlimited messages, all nine agent personalities, automations, multi-agent workflows, and priority model access.

Step 5: Start chatting. Head to the Chat page from the dashboard sidebar. Type a message, ask a question, request a reminder, or simply say hello. Your agent will respond based on its personality and your configured preferences. You can switch agents at any time using the agent selector in the chat header.

Tips for new users: Try asking your agent to "set a reminder for tomorrow at 9am" or "summarize my week" to see the power of natural language understanding. Explore the sidebar to discover features like Focus Timer, Habits, Calendar, Automations, and the Agent Office.`,
      },
      {
        title: 'Agent Personalities',
        summary: 'Understand the nine agent personas and how to pick the right one for your workflow.',
        content: `Agentin ships with nine distinct agent personalities, each designed for specific use cases and communication styles. Understanding these personalities helps you get the most out of your AI assistant.

Weebo is the default creative companion. Weebo excels at brainstorming, content creation, casual conversation, and creative problem-solving. Weebo uses a warm, encouraging tone and often suggests alternative approaches you might not have considered. Best for: writers, designers, marketers, and anyone who values creative collaboration.

Jarvis is your precision-focused productivity assistant. Modeled after the concept of an executive assistant, Jarvis is concise, organized, and action-oriented. Jarvis excels at scheduling, task management, data analysis, and structured workflows. Best for: managers, founders, and professionals who need efficiency.

Edith is the deep researcher and analyst. Edith takes a thorough, methodical approach to every request. She excels at research synthesis, competitive analysis, technical documentation, and detailed explanations. Best for: researchers, analysts, students, and anyone who needs depth over speed.

Cal is your calendar and scheduling specialist. Cal understands time zones, meeting conflicts, and optimal scheduling patterns. Ask Cal to plan your week, find free slots, or suggest the best time for a meeting. Cal integrates directly with Google Calendar.

Nova focuses on financial tracking and investment insights. Nova can help you track expenses, analyze spending patterns, monitor portfolio allocations, and provide market context. Best for: freelancers, investors, and anyone managing personal finances.

Sage is your wellness and habits coach. Sage specializes in habit formation, focus optimization, mindfulness reminders, and work-life balance suggestions. Best for: anyone looking to build better daily routines.

Pixel handles image generation and visual tasks. Pixel can create images from text descriptions, suggest design concepts, and help with visual brainstorming. Pixel uses DALL-E and Stable Diffusion models under the hood.

Bolt is the coding assistant. Bolt excels at code generation, debugging, code review, and technical architecture discussions. Bolt supports dozens of programming languages and frameworks. Best for: developers and technical professionals.

Scout monitors your integrations and provides proactive alerts. Scout watches your connected services (GitHub, Calendar, health checks) and surfaces relevant notifications before you ask. Best for: DevOps engineers and team leads.

You can switch between agents at any time. Each agent remembers your conversation history independently, so you can maintain separate threads for different types of work.`,
      },
      {
        title: 'Connecting Telegram',
        summary: 'Link your Telegram account to chat with your agent on the go and receive notifications.',
        content: `Telegram is the primary mobile interface for Agentin. Once connected, you can chat with your AI agent, receive reminders, get proactive notifications, and trigger automations -- all from the Telegram app on your phone.

Setting up the connection: Navigate to Settings in the Agentin dashboard sidebar, then select the Connections tab. Find the Telegram card and click "Connect". You will see a bot username (e.g., @agentinchatbot) and a one-time verification code.

Step 1: Open Telegram and search for the bot username shown in your dashboard. Start a conversation with the bot by pressing "Start" or sending /start.

Step 2: The bot will ask you to verify your identity. Send the verification code that appeared in your Agentin dashboard. This links your Telegram chat ID to your Agentin account securely.

Step 3: Once verified, you will see a confirmation message in both Telegram and the Agentin dashboard. The connection status will change to "Connected" with a green indicator.

What you can do via Telegram: Send messages to chat with your active agent just like you would on the web dashboard. All nine agent personalities are available. Set reminders by typing natural language like "remind me tomorrow at 3pm to call the client". Receive proactive messages including daily briefings, overdue alerts, streak milestones, and automation results. Trigger automations that are configured with the Telegram action type. Share images for analysis or generation.

Advanced features: You can use /switch followed by an agent name to change your active agent (e.g., /switch jarvis). Use /focus to toggle Focus Mode, which pauses non-urgent notifications. Use /habits to see your daily habit checklist and log completions.

Troubleshooting: If messages stop arriving, check that your Telegram bot token is still valid in Settings > Connections. Ensure you have not blocked the bot. If the bot becomes unresponsive, try sending /start again to re-initialize the session. You can disconnect and reconnect at any time without losing your conversation history.

Privacy note: Agentin only reads messages you send directly to the bot. It does not access your other Telegram conversations, groups, or channels.`,
      },
    ],
  },
  {
    id: 'features',
    icon: Zap,
    title: 'Features',
    description: 'Deep dives into AI Inbox, Image Generation, and Automations',
    articles: [
      {
        title: 'AI Inbox',
        summary: 'Let your agent summarize, draft replies, and manage your email with Gmail integration.',
        content: `The AI Inbox is one of Agentin's most powerful productivity features. It connects to your Gmail account and gives your AI agent the ability to read, summarize, and help you respond to emails -- all while keeping you in control.

How it works: When you connect your Google account with Gmail permissions (gmail.readonly and gmail.send scopes), Agentin can access your recent emails. Your AI agent reads email metadata and content to provide intelligent summaries and suggestions. No emails are stored permanently on Agentin servers -- they are processed in real-time and cached only for the duration of your session.

Email summaries: Navigate to the Inbox page from the dashboard sidebar. Your agent will automatically fetch your latest unread emails and present them as concise summaries. Each summary includes the sender, subject, a brief overview of the content, and suggested actions (reply, archive, follow up later). You can ask your agent to elaborate on any specific email by clicking it or typing "tell me more about the email from [sender]".

Smart replies: When you select an email, your agent can draft a reply based on the email content and your communication style. You can specify the tone (formal, casual, friendly) and any specific points you want to address. The draft appears in an editor where you can review, edit, and send it directly. Agentin never sends an email without your explicit approval -- you always click the "Send" button.

Batch processing: For busy inboxes, you can ask your agent to "summarize all emails from today" or "find all emails about the project deadline". The agent processes multiple emails simultaneously and presents organized summaries grouped by sender, topic, or urgency.

Privacy and security: Gmail integration uses OAuth 2.0 tokens that you can revoke at any time from Settings > Connections. Agentin requests only the minimum required scopes. Email content is processed in memory and never written to the database. You can disconnect Gmail at any time, and all cached email data is immediately purged.`,
      },
      {
        title: 'Image Generation',
        summary: 'Create images from text prompts using AI models directly within Agentin.',
        content: `Agentin includes built-in image generation capabilities powered by DALL-E and Stable Diffusion models. You can create images from text descriptions, iterate on designs, and use generated images in your workflow -- all without leaving the platform.

Getting started with image generation: Switch to the Pixel agent or simply ask any agent to generate an image. Type a descriptive prompt like "a minimalist logo for a tech startup using purple and green gradients" or "a photorealistic landscape of the Western Ghats at sunset". The agent will process your request and return a generated image within seconds.

Prompt tips for better results: Be specific about style (photorealistic, illustration, watercolor, 3D render, pixel art). Mention composition details (close-up, wide angle, bird's eye view, centered). Include color preferences and mood (warm tones, moody lighting, vibrant, pastel). Reference artistic styles when relevant (in the style of Studio Ghibli, Bauhaus-inspired, Art Deco).

Image tools: Beyond basic generation, Agentin offers a suite of image manipulation tools accessible from the Image Tools page in the sidebar. These include resize and crop (adjust dimensions for social media, presentations, or print), format conversion (PNG, JPEG, WebP with quality controls), background removal (isolate subjects from backgrounds), and batch processing (apply the same operations to multiple images).

Using generated images: All generated images are saved to your account and accessible from the Image Gallery. You can download them in various formats, use them directly in social media posts through the Social Media Handler, or attach them to documents in the Docs Workspace.

Credits and limits: Image generation consumes AI credits from your account balance. Each standard generation uses approximately 5 credits. Higher resolution or more complex generations may use more. Free tier users receive 10 image generations per day. Pro users get unlimited standard generations.

Content policy: Generated images must comply with Agentin's content guidelines. The system automatically filters prompts that request harmful, explicit, or misleading content. If a prompt is rejected, the agent will explain why and suggest alternatives.`,
      },
      {
        title: 'Building Automations',
        summary: 'Create triggers, actions, and workflows that run on autopilot.',
        content: `Automations are the backbone of Agentin's "set it and forget it" productivity philosophy. An automation consists of a trigger (when something happens) and an action (do something in response). Once created, automations run continuously in the background without any manual intervention.

Understanding triggers: Agentin supports six trigger types. Scheduled triggers fire at regular intervals (every 15 minutes, hourly, daily, weekly) and are perfect for recurring reports, reminders, and check-ins. Event triggers respond to system events like new reminders, completed habits, or expense entries. Webhook triggers listen for incoming HTTP POST requests, allowing external services to trigger your automations. Keyword triggers activate when a message containing a specific word or phrase is sent to your agent. Health check triggers monitor a URL and fire when the endpoint returns an error or becomes unreachable. Manual triggers are activated on-demand from the Automations page.

Understanding actions: Each trigger is paired with an action that executes when the trigger fires. Telegram Message sends a formatted message to your connected Telegram account. API Call makes an HTTP request to any endpoint with configurable method, URL, and headers. Create Reminder automatically creates a new reminder with specified text and optional datetime. n8n Webhook forwards the trigger payload to an n8n workflow for complex multi-step processing. Log records the event for debugging and audit purposes.

Creating your first automation: Navigate to Automations from the sidebar. Click "New Automation" or choose from the template gallery. Templates include Morning Brief (daily summary at 7am), Site Monitor (check URL health every hour), Expense Alert (notify when expense keyword detected), and Weekly Summary (habit and expense report every Monday).

Give your automation a descriptive name, select a trigger type, configure the trigger parameters, choose an action, and fill in the action payload. Click "Create Automation" to activate it. You can test automations using the dry run feature (flask icon) which simulates the action without executing it.

Monitoring and debugging: Each automation card shows its status (active, paused, error), run count, last run time, and last status. Expand the "Run history" section to see detailed logs for each execution, including output, HTTP status codes, and response times. The Recent Runs table at the bottom of the page shows all automation executions across your account.

Advanced patterns: Chain multiple automations by having one automation's action trigger another's webhook. Use keyword triggers to build chatbot-like flows. Combine health check triggers with Telegram actions for uptime monitoring. Schedule daily automations to aggregate data and send formatted reports.`,
      },
    ],
  },
  {
    id: 'agent-office',
    icon: Bot,
    title: 'Agent Office',
    description: 'Master the multi-agent workspace, task assignment, and workflows',
    articles: [
      {
        title: 'Understanding the Agent Office',
        summary: 'A visual workspace where your AI agents collaborate, each with defined roles and capabilities.',
        content: `The Agent Office is Agentin's multi-agent workspace -- a visual environment where your AI agents live, work, and collaborate. Think of it as a virtual office floor where each agent sits at their desk, ready to handle tasks within their area of expertise.

The office layout: When you open the Agent Office from the sidebar, you see a visual representation of your active agents. Each agent has a status indicator (online, busy, idle), their current task (if any), and quick action buttons. The office uses a clean grid layout that adapts to your screen size -- three columns on desktop, two on tablet, and a single column on mobile.

Agent roles and capabilities: Each agent in the office has a defined role that determines what tasks they handle. Weebo handles creative tasks (content writing, brainstorming, social media). Jarvis manages productivity (scheduling, task management, email processing). Edith conducts research (market analysis, competitor research, document summarization). Each agent's card shows their specialization and recent activity.

The Spotlight HUD: At the top of the Agent Office, the Spotlight HUD provides a quick overview of your workspace. It shows total active agents, tasks in progress, tasks completed today, and system health status. The HUD updates in real-time as agents process tasks.

Insight Toasts: As agents work, they surface insights through non-intrusive toast notifications. These might include pattern observations ("You tend to schedule meetings on Tuesdays -- should I block time?"), performance suggestions ("Edith found three relevant articles for your research"), or completion alerts ("Jarvis finished processing your morning emails").

The office is more than a visualization -- it is a control center. You can pause agents, reassign tasks, view agent logs, and configure agent behavior all from this single interface. This centralized approach means you never need to wonder which agent is doing what.`,
      },
      {
        title: 'Assigning Tasks to Agents',
        summary: 'Route work to the right agent manually or let the system auto-delegate based on context.',
        content: `Task assignment in Agentin can be manual (you choose the agent) or automatic (the system routes to the best agent). Understanding both approaches helps you get the most efficient results.

Manual assignment: From the chat interface, use the agent selector dropdown in the header to choose which agent should handle your request. Each agent's name appears with a colored indicator showing their status. When you select an agent and send a message, that agent processes your request using their specific personality, knowledge base, and capabilities.

Auto-delegation: When you send a message to the default agent or use the "Ask anyone" option, Agentin's routing system analyzes your request and automatically delegates it to the most appropriate agent. The routing considers keyword analysis (coding-related terms go to Bolt, scheduling terms go to Cal), context from your conversation history, agent workload and availability, and your configured preferences.

Task routing examples: "Write a blog post about AI trends" routes to Weebo (creative content). "Review this pull request" routes to Bolt (code analysis). "What meetings do I have tomorrow?" routes to Cal (calendar). "Analyze our competitor's pricing" routes to Edith (research). "How are my investments doing?" routes to Nova (finance).

Priority and queuing: When you assign multiple tasks simultaneously, they enter a priority queue. Urgent tasks (marked with high priority or time-sensitive keywords) are processed first. You can view the task queue from the Agent Office and manually reorder tasks if needed.

Task results: When an agent completes a task, the result appears in your chat thread. If the task was auto-delegated, the response includes a subtle indicator showing which agent handled it. You can provide feedback (thumbs up/down) which helps the routing system learn your preferences over time.

Batch assignment: For complex projects, you can describe a multi-step task and Agentin will break it down, assigning each step to the most appropriate agent. For example, "Research our top 3 competitors, write a comparison blog post, and schedule it for next Tuesday" would involve Edith (research), Weebo (writing), and Cal (scheduling) working in sequence.`,
      },
      {
        title: 'Multi-Agent Workflows',
        summary: 'Chain agents together in sequential pipelines where each agent builds on the previous output.',
        content: `Multi-agent workflows are Agentin's most advanced feature. They allow you to create sequential pipelines where multiple agents collaborate on a complex task, each contributing their specialized expertise to the final result.

How workflows work: A workflow consists of ordered steps, each assigned to a specific agent. The output of one step becomes the input context for the next step. This creates a chain of specialized processing that produces results no single agent could achieve alone.

Creating a workflow: Navigate to Workflows from the sidebar. Click "New Workflow" to open the builder. Give your workflow a name and description. Then add steps by selecting an agent, writing a prompt template, and defining an output key. Prompt templates can reference outputs from previous steps using curly brace notation like "Based on the research: {step1_output}, write a blog post."

Example workflow -- Content Pipeline: Step 1 (Edith): "Research the latest trends in {topic} and provide 5 key findings with sources." Output key: research. Step 2 (Weebo): "Using this research: {research}, write a 500-word blog post that is engaging and informative." Output key: draft. Step 3 (Bolt): "Review this blog post for technical accuracy: {draft}. Flag any errors or improvements." Output key: review.

Running workflows: Trigger a workflow manually from the Workflows page, on a schedule using Automations, or via the API. When a workflow runs, you see real-time progress as each step executes. Each step shows its status (pending, running, done, error) and output. If a step fails, the workflow pauses and you can retry from the failed step.

Workflow variables: When triggering a workflow, you can pass context variables that are available to all steps. For example, a content pipeline workflow might accept a "topic" variable that gets injected into the first step's prompt.

Monitoring and debugging: Each workflow run is logged with full execution details. The Workflows page shows run history, average execution time, success rate, and recent outputs. You can click into any run to see step-by-step execution details, timing, and the exact prompts and responses for each agent.

Best practices: Keep workflows focused on a single outcome. Use 2-4 steps maximum for reliability. Write clear prompt templates that specify exactly what each agent should produce. Test workflows with dry runs before scheduling them. Monitor failure rates and adjust prompts if a step consistently fails.`,
      },
    ],
  },
  {
    id: 'productivity',
    icon: Settings,
    title: 'Productivity',
    description: 'Focus timer, habit tracking, smart reminders, and scheduling',
    articles: [
      {
        title: 'Focus Timer & Habits',
        summary: 'Use Pomodoro-style focus sessions and daily habit tracking to build consistency.',
        content: `Agentin's Focus and Habits system is designed to help you build productive routines and maintain consistency over time. It combines a configurable focus timer with daily habit tracking and streak mechanics.

Focus Timer: The Focus page features a Pomodoro-inspired timer with four duration presets: 25 minutes (classic Pomodoro), 45 minutes (deep work), 60 minutes (flow state), and 90 minutes (ultra focus). Click "Start Focus" to begin a session. The timer runs in the background using a Web Worker, so it continues accurately even if you switch browser tabs.

During a focus session, the timer displays elapsed time and remaining time in a circular progress ring. The ring color shifts from cyan to lime to pink as you progress, providing a visual cue of your session status. When Focus Mode is active, non-urgent notifications are suppressed -- only urgent alerts (like overdue reminders) break through.

Session tracking: Every completed focus session is logged with its start time, duration, goal text, and completion status. The Focus page shows your session history, weekly statistics (total sessions, total minutes, average session length, longest session), and your current focus streak -- the number of consecutive days with at least one completed session.

Break suggestions: When a focus session ends, Agentin suggests a short break activity randomly selected from a curated list: take a walk, stretch, drink water, do breathing exercises, or look away from the screen. These micro-breaks help prevent burnout and maintain sustained productivity.

Habit Tracking: Below the focus timer, you will find your habit tracker. Create habits with a name, icon, and frequency (daily, 3x per week, weekdays). Each day, log your habits by tapping the checkmark. Agentin tracks your current streak and longest streak for each habit, providing motivation through visible progress.

The weekly grid shows your habit completion pattern across the last seven days, making it easy to spot trends and gaps. When you complete all habits for the day, a celebration animation plays to reinforce the positive behavior.

Integration with agents: Your focus and habit data feeds into your agent's context. When you ask Jarvis to "plan my day", it considers your focus session history and pending habits. Sage (the wellness agent) uses this data to provide personalized productivity coaching and habit formation advice.`,
      },
      {
        title: 'Reminders & Scheduling',
        summary: 'Set reminders with natural language, manage recurring schedules, and integrate with your calendar.',
        content: `Agentin's reminder system is designed to understand how you naturally think about time. Instead of filling out forms, simply type what you need to remember and when, and the AI handles the rest.

Natural language input: The Reminders page features a smart input field that understands expressions like "remind me tomorrow at 3pm to call mom", "every Monday at 9am team standup", "in 2 hours take a break", and "next Tuesday submit the report". The parser extracts the task, date, time, and recurrence pattern automatically. A live preview shows you how the system interpreted your input before you confirm.

Reminder properties: Each reminder has a text description, datetime, category (personal, work, health, other), priority (low, normal, high, urgent), channel (Telegram, email, push), and optional recurrence (daily, weekly, monthly). Categories are color-coded for visual scanning. Priority levels affect sorting and notification urgency.

Views and filters: Toggle between list view and calendar view. Filter by status (all, active, completed), recurrence (all, recurring, one-off), category, and priority. Search across all reminders using the search bar. Filters persist across sessions so your preferred view is always ready.

Overdue handling: Reminders that have passed their datetime without being completed are marked as overdue with a red border and sorted to the top of the list. You can snooze overdue reminders (push them forward by 1 hour, 3 hours, tomorrow, or next week), complete them, or delete them. Bulk snooze lets you handle multiple overdue reminders at once.

Calendar integration: When Google Calendar is connected, your reminders and calendar events appear together in a unified timeline. The Planner page merges both data sources into a drag-and-drop daily schedule, so you can see your full day at a glance.

Notification channels: Reminders are delivered through your configured channels. Telegram notifications arrive as formatted messages with action buttons (complete, snooze). Push notifications work in supported browsers. Email notifications include the reminder text and a link to complete it from the web dashboard.

Smart suggestions: When you create a reminder, your agent may suggest improvements. For example, if you set a reminder for "submit report" at 5pm on Friday, the agent might suggest setting it for Thursday afternoon to give yourself buffer time.`,
      },
      {
        title: 'Daily & Weekly Planning',
        summary: 'Use the Planner to time-block your day and let Cal organize your optimal schedule.',
        content: `The Planner is Agentin's daily time-blocking interface, inspired by tools like Sunsama and Cal.com. It provides a visual timeline where you can drag tasks from a backlog into specific time slots, creating a structured plan for your day.

The daily view: The Planner displays a vertical timeline from 6 AM to 11 PM, with each hour as a row. The current time is marked with a red indicator line that moves in real-time. Each time slot can hold one or more blocks, represented as colored cards showing the task name, type icon, and duration.

The backlog panel: On the left side (or top on mobile), the backlog panel shows your unscheduled items for the selected day. This includes active reminders with matching dates and habits that haven't been logged yet. Each backlog item shows its type (reminder or habit), priority level, and a drag handle.

Creating time blocks: There are three ways to add blocks to your timeline. Drag and drop: grab a backlog item and drop it onto a time slot. The block is created with a default 1-hour duration. Quick add: click the plus icon on any empty time slot to create a custom block with a title and duration (15m, 30m, 1h, or 2h). API sync: blocks created through the API or by Cal agent are automatically populated.

Block types and colors: Reminder blocks are cyan, habit blocks are green, and custom blocks are purple. These colors help you quickly identify the nature of each time block at a glance. The left border of each block matches its type color.

Date navigation: Use the arrow buttons to navigate between days. Click the date header to jump back to today. Each day maintains its own set of blocks, persisted both locally (for instant loading) and on the server (for cross-device sync).

Statistics: The header shows three key metrics: planned items (number of blocks), blocked hours (total scheduled time), and percentage of day covered. These metrics update in real-time as you add or remove blocks.

Cal integration: Click "Ask Cal to plan my week" to open a chat with the Cal agent, who can analyze your reminders, habits, calendar events, and past patterns to suggest an optimal daily schedule. Cal considers your energy patterns (morning person vs. night owl), meeting buffers, and habit completion rates when generating a plan.

Persistence: All blocks are saved automatically. They sync to the server in the background and are cached locally for offline access. If the server is unavailable, blocks are preserved in local storage and synced when connectivity returns.`,
      },
    ],
  },
  {
    id: 'settings',
    icon: Shield,
    title: 'Settings & Security',
    description: 'Manage privacy, subscriptions, and API keys',
    articles: [
      {
        title: 'Privacy Settings',
        summary: 'Control what data your agent can access, how memories are stored, and export or delete your data.',
        content: `Agentin gives you fine-grained control over your privacy. Every data access point is configurable, and you can review, export, or delete your data at any time.

Data access controls: In Settings > Privacy, you can toggle individual data categories that your agent can access. These include conversation history (agent remembers previous chats), memory facts (agent stores learned facts about you), calendar events (agent reads your schedule), email access (agent reads Gmail for inbox features), and habit and focus data (agent uses your productivity patterns for suggestions).

Each toggle takes effect immediately. Disabling a category means your agent will not reference that data source, even if the underlying connection is still active. This allows you to temporarily limit agent access without disconnecting integrations.

Memory management: Agentin stores "memory facts" -- key pieces of information your agent learns about you over time (your name, preferences, timezone, work schedule, etc.). Navigate to Memory from the sidebar to view all stored facts. You can edit or delete individual facts, or clear all memories to start fresh. Memory facts are stored encrypted in your personal database namespace.

Conversation retention: By default, conversations are retained for 90 days. You can change this in Settings > Privacy to 30 days, 7 days, or "session only" (conversations are deleted when you log out). Shorter retention means less context for your agent but more privacy.

Data export: Click "Export My Data" in Settings > Privacy to download a complete archive of your Agentin data in JSON format. This includes your profile, conversations, reminders, habits, focus sessions, automations, and memory facts. The export is generated on-demand and available for download within a few minutes.

Account deletion: You can permanently delete your account from Settings > Account. This irreversibly removes all your data from Agentin servers, including conversations, memories, integrations, and usage history. Connected OAuth tokens (Google, Telegram) are revoked as part of the deletion process.

Third-party data: Agentin does not sell, share, or use your data for training AI models. Your data exists only on the Agentin infrastructure and is processed solely to provide the features you use. See our full Privacy Policy at /privacy for detailed information.`,
      },
      {
        title: 'Subscription Management',
        summary: 'Upgrade, downgrade, or manage your Pro subscription and understand credit usage.',
        content: `Agentin offers two tiers: Free and Pro. Understanding what each tier includes helps you choose the right plan for your needs.

Free tier: The free plan includes 50 AI messages per day across all agents, 1 active agent at a time, basic reminders and habit tracking, 10 image generations per day, 3 automations, and community support. The free tier is designed to give you a genuine experience of Agentin without any payment required. There is no trial period -- free accounts remain free forever.

Pro tier: The Pro plan unlocks the full Agentin experience. It includes unlimited AI messages, all 9 agent personalities simultaneously, unlimited automations with advanced triggers, multi-agent workflows, priority model access (faster responses, newer models), advanced analytics and insights, image generation with no daily limit, API access for programmatic integration, and priority support via email.

Upgrading: Navigate to Settings > Subscription or click the "Upgrade" button visible throughout the free tier experience. Select the Pro plan and complete payment through our secure payment processor. Your account is upgraded immediately and all Pro features become available within seconds.

Managing your subscription: The Subscription page shows your current plan, billing cycle, next payment date, and usage statistics. You can update your payment method, download invoices, or cancel your subscription. Cancellation takes effect at the end of the current billing cycle -- you retain Pro access until then.

Credit system: AI interactions consume credits from your account balance. Standard text messages use 1 credit. Image generations use 5 credits. Workflow steps use 1 credit each. Premium model requests may use 2-3 credits. Free accounts receive 50 credits daily (reset at midnight UTC). Pro accounts have unlimited credits.

Usage analytics: The Settings page shows detailed usage breakdowns including daily message count by agent, credit consumption over time, most-used features, and API request counts. This helps you understand your usage patterns and optimize your workflow.`,
      },
      {
        title: 'API Key Management',
        summary: 'Add your own LLM API keys, manage third-party tokens, and understand key rotation.',
        content: `Agentin supports "bring your own key" (BYOK) for LLM providers, giving you control over which models power your agents and how much you spend on AI inference.

Adding API keys: Navigate to Settings > API Keys. Click "Add Key" and select the provider: OpenAI (GPT-4, GPT-4o, GPT-3.5), Anthropic (Claude 3.5 Sonnet, Claude 3 Opus), Google (Gemini Pro, Gemini Ultra), Groq (Llama, Mixtral), Together AI (open-source models), or OpenRouter (multi-model gateway). Enter your API key and click Save. The key is encrypted at rest using AES-256 and never transmitted in plaintext.

Key priority and fallback: When you add multiple keys, Agentin creates a fallback chain. If the primary provider is unavailable or rate-limited, requests automatically fall through to the next available provider. You can drag keys to reorder the priority chain. The default chain is: your BYOK keys first, then Agentin's shared pool (for Pro users).

Testing keys: After adding a key, use the "Test" button to verify it works. The test sends a simple request to the provider and reports success, latency, and the model version. This helps catch invalid keys or quota issues before they affect your workflow.

Key rotation: For security, rotate your API keys periodically. Click the "Rotate" button next to any key to generate a new key through the provider's API (if supported) or to update the stored key manually. The old key is securely deleted from Agentin's storage.

Usage monitoring: Each API key shows its usage statistics: total requests, tokens consumed, estimated cost, and error rate. This helps you track spending across providers and identify keys that may be approaching their quota limits.

Security best practices: Never share your API keys or include them in screenshots. Use separate keys for Agentin rather than keys used in other applications. Set spending limits on your provider accounts as an additional safety net. Review the API Keys page monthly and remove any keys you no longer need. If you suspect a key has been compromised, rotate it immediately and check your provider dashboard for unauthorized usage.`,
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: HelpCircle,
    title: 'Troubleshooting',
    description: 'Fix connection issues, understand credits, and get help',
    articles: [
      {
        title: 'Connection Issues',
        summary: 'Diagnose and fix problems with Telegram, Google, and other integrations.',
        content: `Connection issues are the most common problems users encounter. This guide covers diagnosis and resolution for each integration type.

Telegram not receiving messages: First, verify the connection status in Settings > Connections. If it shows "Disconnected", reconnect by following the Telegram setup process. If it shows "Connected" but messages are not arriving, check these common causes. The bot may have been blocked -- open Telegram, find the bot, and ensure it is not in your blocked list. Your Telegram chat ID may have changed -- this can happen if you delete and recreate your Telegram account. Reconnect to update the chat ID. The bot token may be expired -- regenerate it through BotFather and update it in Agentin settings.

Google Calendar not syncing: Google OAuth tokens expire after a set period. If Calendar stops syncing, navigate to Settings > Connections and click "Reconnect" on the Google Calendar card. This refreshes the OAuth token. If reconnection fails, go to your Google Account security settings (myaccount.google.com/permissions), revoke Agentin's access, and then reconnect from scratch. Verify that the Calendar API is not rate-limited -- if you have many events, the initial sync may take a few minutes.

Gmail integration issues: Similar to Calendar, Gmail uses OAuth tokens that may expire. The fix is the same: reconnect from Settings. If emails are not appearing in the Inbox, verify that you granted the gmail.readonly scope during the OAuth flow. You can check granted scopes in your Google Account permissions page.

Agent not responding: If your agent stops responding to messages, try refreshing the page. Check the system health indicator in the sidebar footer -- if any services show red, the backend may be experiencing issues. Try switching to a different agent to isolate whether the issue is agent-specific. Clear your browser cache and try again.

Slow responses: Response speed depends on the AI model being used. Premium models (GPT-4, Claude Opus) are slower but more capable. If speed is a priority, switch to faster models (GPT-4o-mini, Claude Sonnet) in Settings > Agent Configuration. Check your network connection -- slow internet can increase apparent response times. If using BYOK keys, verify your API key has not hit rate limits with the provider.

General debugging: The Terminal page provides a developer-friendly interface for diagnosing issues. You can view API request logs, check service health, and run diagnostic commands. The /status command shows all connected services and their health status.`,
      },
      {
        title: 'Credit & Billing FAQ',
        summary: 'Understand how credits work, what counts as usage, and how to manage your spending.',
        content: `Credits are the unit of measurement for AI interactions in Agentin. This FAQ answers the most common questions about the credit system.

What is a credit? A credit represents one unit of AI processing. Different operations consume different numbers of credits based on their complexity and the computational resources required.

How many credits do I get? Free accounts receive 50 credits per day, reset at midnight UTC. Pro accounts have unlimited credits -- you can use as many as you need without worrying about limits.

What consumes credits? Standard text messages with your agent use 1 credit per message. Image generations use approximately 5 credits each (varies by resolution). Workflow steps use 1 credit per step. Automation executions that involve AI processing use 1 credit. Email summarization uses 1 credit per batch. Calendar analysis uses 1 credit. Some premium model requests may use 2-3 credits for particularly long or complex responses.

What does not consume credits? Viewing dashboards and pages. Setting reminders (unless they trigger an AI response). Logging habits. Navigating the Agent Office. Managing settings and connections. Viewing automation logs. Using the focus timer.

I ran out of credits -- what happens? When your daily credits are exhausted on a free account, AI-powered features pause until the next day. You can still access all non-AI features: reminders, habits, focus timer, calendar, and settings. Automation executions that require AI processing are queued until credits are restored. Consider upgrading to Pro for unlimited usage.

Can I buy additional credits without upgrading to Pro? Currently, credits are bundled with the subscription tier. The free tier offers 50 daily credits and Pro offers unlimited. We are evaluating pay-as-you-go credit packs for a future release.

How do BYOK keys affect credits? When you bring your own API keys (BYOK), messages processed through your keys do not consume Agentin credits. You pay the provider directly for API usage. This gives you unlimited usage at your provider's rates, regardless of your Agentin subscription tier.

How do I check my usage? Navigate to Settings > Subscription to see your daily and monthly usage breakdown. The dashboard overview page also shows a credit usage indicator. The analytics page provides detailed per-agent and per-feature usage charts.`,
      },
      {
        title: 'Getting Help',
        summary: 'Contact support, report bugs, request features, and access community resources.',
        content: `Agentin provides multiple channels for getting help, reporting issues, and connecting with other users.

In-app help: Your AI agent is the first line of support. Ask any agent "how do I..." or "help me with..." and they will provide guidance based on their knowledge of Agentin's features. This is often the fastest way to get answers for common questions.

Email support: For account-specific issues, billing questions, or problems that require human assistance, email support@agentin.chat. Include your username, a description of the issue, and any error messages or screenshots. Pro users receive priority support with typical response times under 4 hours during business hours.

Bug reports: If you encounter a bug, report it through the Terminal page using the /bug command followed by a description. This automatically captures your browser version, operating system, and relevant session data (without sensitive information) to help the development team reproduce and fix the issue.

Alternatively, open an issue on the GitHub repository if the project is open-source. Include steps to reproduce the bug, expected behavior, actual behavior, and screenshots if applicable.

Feature requests: We actively collect and prioritize feature requests from users. Use the /feature command in the Terminal page to submit a request, or email feature requests to support@agentin.chat with the subject line "Feature Request: [brief description]". The Roadmap page in the dashboard shows upcoming features and their development status.

Community resources: The documentation you are reading now covers all major features. Each article is regularly updated as features evolve. If you find information that is outdated or incorrect, use the /feedback command to let us know.

Self-service troubleshooting checklist: Before contacting support, try these steps. Refresh the page (Ctrl/Cmd + Shift + R for hard refresh). Clear browser cache and cookies for the Agentin domain. Try a different browser to rule out browser-specific issues. Check Settings > Connections for any disconnected integrations. Verify your internet connection is stable. Check the system health indicator in the sidebar footer. If using BYOK keys, verify they are valid and within quota at the provider's dashboard.

Status page: Check the current system status and any ongoing incidents. The health endpoint at /api/health shows the status of all 12 backend services in real-time.`,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filtered = searchQuery
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.articles.some(
            (a) =>
              a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              a.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
              a.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : docs;

  const articleKey = (sectionId: string, articleTitle: string) =>
    `${sectionId}::${articleTitle}`;

  return (
    <div className="min-h-dvh pb-24 md:pb-8" style={{ background: '#06061a' }}>
      {/* animations */}
      <style>{`
        @keyframes docs-pulse-glow{0%,100%{opacity:0.03}50%{opacity:0.06}}
        @keyframes docs-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-20px) scale(1.05)}}
        @keyframes docs-card-in{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* aurora gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)
        `,
      }} />

      {/* dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* depth blob */}
      <div
        className="fixed left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full pointer-events-none"
        style={{ background: 'rgba(139, 92, 246, 0.025)', filter: 'blur(140px)', animation: 'docs-pulse-glow 8s ease-in-out infinite' }}
      />

      {/* floating orbs */}
      <div
        className="fixed top-[15%] left-[10%] w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'rgba(16, 185, 129, 0.03)', filter: 'blur(60px)', animation: 'docs-float 12s ease-in-out infinite' }}
      />
      <div
        className="fixed top-[60%] right-[8%] w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'rgba(245, 158, 11, 0.02)', filter: 'blur(80px)', animation: 'docs-float 16s ease-in-out infinite 3s' }}
      />

      {/* sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-[rgba(139,92,246,0.08)] bg-[#06061a]/80"
        style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-xs min-h-[44px] min-w-[44px] justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to Agentin</span>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo-agentin.webp" alt="Agentin" className="w-6 h-6 object-contain" />
              <div>
                <h1 className="text-base font-semibold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Documentation
                </h1>
                <p className="text-[10px] text-white/40 leading-tight">Powered by Agentin</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B5CF6]/20 to-transparent" />
      </header>

      {/* content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        {/* hero text */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#F4F6FF] tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Documentation
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
            Everything you need to know about Agentin -- {docs.reduce((n, s) => n + s.articles.length, 0)} articles across {docs.length} sections
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8" style={{ animation: 'docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) 0ms both' }}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 text-base rounded-xl border border-[rgba(139,92,246,0.08)] text-[#F4F6FF] placeholder:text-[#9CA3AF]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 focus-visible:border-[#8B5CF6]/30 transition-all"
            style={{
              background: 'rgba(12,12,30,0.6)',
              backdropFilter: 'blur(24px) saturate(180%)',
            }}
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filtered.map((section, i) => (
            <div
              key={section.id}
              className="rounded-2xl border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-300 overflow-hidden"
              style={{
                background: 'rgba(12,12,30,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                animation: `docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${(i + 1) * 60}ms both`,
              }}
            >
              <div className="p-5">
                <button
                  className="flex items-center gap-4 w-full text-left min-h-[44px]"
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#F4F6FF]">{section.title}</h3>
                    <p className="text-sm text-[#9CA3AF]">{section.description}</p>
                  </div>
                  <span className="text-xs text-[#9CA3AF] mr-2 hidden sm:inline">{section.articles.length} articles</span>
                  <ChevronRight
                    className={`w-5 h-5 text-[#9CA3AF] transition-transform duration-300 flex-shrink-0 ${
                      expandedSection === section.id ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {expandedSection === section.id && (
                  <div className="mt-4 ml-0 sm:ml-14 space-y-3 border-t border-[rgba(139,92,246,0.08)] pt-4">
                    {section.articles.map((article) => {
                      const key = articleKey(section.id, article.title);
                      const isOpen = expandedArticle === key;
                      return (
                        <div
                          key={article.title}
                          className="rounded-lg border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-colors overflow-hidden"
                          style={{ background: 'rgba(12,12,30,0.5)' }}
                        >
                          <button
                            className="flex items-center gap-3 w-full text-left p-4 min-h-[44px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedArticle(isOpen ? null : key);
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-[#F4F6FF] mb-0.5">{article.title}</h4>
                              <p className="text-xs text-[#9CA3AF] line-clamp-2">{article.summary}</p>
                            </div>
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                            )}
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 border-t border-[rgba(139,92,246,0.06)]">
                              <div className="pt-4 text-sm text-[#9CA3AF] leading-relaxed whitespace-pre-line">
                                {article.content}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-[#8B5CF6]/30 mx-auto mb-4" />
            <p className="text-[#9CA3AF]">No docs match your search</p>
          </div>
        )}

        {/* contact footer */}
        <div
          className="mt-12 p-6 rounded-2xl border border-[rgba(139,92,246,0.08)]"
          style={{
            background: 'rgba(12,12,30,0.6)',
            backdropFilter: 'blur(24px) saturate(180%)',
            animation: `docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${(filtered.length + 1) * 60}ms both`,
          }}
        >
          <p className="text-sm text-[#9CA3AF]">
            Need help? Contact us at{' '}
            <a href="mailto:support@agentin.chat" className="text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors">
              support@agentin.chat
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
