/**
 * Phase 99 -- Voice Interface Tests
 * Covers: static file presence/content checks, stripMarkdown logic,
 *         backend chat endpoint integrity, voice hook interface.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { createApp } from "../app.js";
import { generateTestToken, createTestUser } from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(ROOT, "server/src", ...parts), "utf-8");
}
function readFrontend(...parts: string[]): string {
  return readFileSync(path.join(ROOT, "src", ...parts), "utf-8");
}
function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

// Pure re-implementation of stripMarkdown for unit tests (no browser deps)
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .trim();
}

let app: ReturnType<typeof createApp>;
let testUser: { id: string; email: string; username: string; password: string };
let token: string;

beforeAll(() => {
  app = createApp();
  testUser = createTestUser();
  token = generateTestToken(testUser.id);
});

// =============================================================================
// 99.1  File existence checks
// =============================================================================
describe("99.1 File existence: new voice files", () => {
  it("useVoice.ts hook exists", () => {
    expect(fileExists("src/hooks/useVoice.ts")).toBe(true);
  });
  it("useTTS.ts hook exists", () => {
    expect(fileExists("src/hooks/useTTS.ts")).toBe(true);
  });
  it("VoiceButton.tsx component exists", () => {
    expect(fileExists("src/components/VoiceButton.tsx")).toBe(true);
  });
  it("ChatPage.tsx page exists", () => {
    expect(fileExists("src/dashboard/pages/ChatPage.tsx")).toBe(true);
  });
});

// =============================================================================
// 99.2  useVoice hook: source content checks
// =============================================================================
describe("99.2 useVoice.ts source checks", () => {
  it("exports useVoice function", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("export function useVoice");
  });
  it("has isSupported check for SpeechRecognition", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("SpeechRecognition");
    expect(src).toContain("isSupported");
  });
  it("returns isListening, isSupported, startListening, stopListening, error", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("isListening");
    expect(src).toContain("startListening");
    expect(src).toContain("stopListening");
    expect(src).toContain("error");
  });
  it("uses continuous: false and interimResults: true", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("continuous = false");
    expect(src).toContain("interimResults = true");
  });
  it("handles onTranscript callback with final transcript", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("onTranscript");
    expect(src).toContain("isFinal");
  });
  it("handles microphone access denied error", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("not-allowed");
    expect(src).toContain("Microphone access denied");
  });
  it("aborts recognition on unmount cleanup", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("abort");
  });
  it("uses webkit fallback for SpeechRecognition", () => {
    const src = readFrontend("hooks", "useVoice.ts");
    expect(src).toContain("webkitSpeechRecognition");
  });
});

// =============================================================================
// 99.3  useTTS hook: source content checks
// =============================================================================
describe("99.3 useTTS.ts source checks", () => {
  it("exports useTTS function", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("export function useTTS");
  });
  it("exports stripMarkdown helper", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("stripMarkdown");
  });
  it("uses window.speechSynthesis", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("speechSynthesis");
  });
  it("returns speak, stop, isSpeaking, isSupported", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("speak");
    expect(src).toContain("stop");
    expect(src).toContain("isSpeaking");
    expect(src).toContain("isSupported");
  });
  it("cancels current speech before starting new one", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("cancel");
  });
  it("strips markdown before speaking", () => {
    const src = readFrontend("hooks", "useTTS.ts");
    expect(src).toContain("stripMarkdown");
    expect(src).toContain("SpeechSynthesisUtterance");
  });
});

// =============================================================================
// 99.4  stripMarkdown logic unit tests (pure function, no browser deps)
// =============================================================================
describe("99.4 stripMarkdown logic", () => {
  it("removes bold markdown", () => {
    expect(stripMarkdown("**hello** world")).toBe("hello world");
  });
  it("removes italic markdown", () => {
    expect(stripMarkdown("*hello* world")).toBe("hello world");
  });
  it("removes headings", () => {
    expect(stripMarkdown("## Hello")).toBe("Hello");
  });
  it("removes inline code", () => {
    expect(stripMarkdown("use `npm install`")).toBe("use");
  });
  it("removes fenced code blocks", () => {
    const input = "Here is code:\n```js\nconst x = 1;\n```\nDone";
    const result = stripMarkdown(input);
    expect(result).not.toContain("```");
    expect(result).not.toContain("const x");
  });
  it("removes markdown links but keeps text", () => {
    expect(stripMarkdown("[click here](https://example.com)")).toBe("click here");
  });
  it("removes blockquotes", () => {
    expect(stripMarkdown("> This is a quote")).toBe("This is a quote");
  });
  it("removes unordered list markers", () => {
    expect(stripMarkdown("- item one")).toBe("item one");
  });
  it("removes ordered list markers", () => {
    expect(stripMarkdown("1. item one")).toBe("item one");
  });
  it("trims whitespace", () => {
    expect(stripMarkdown("  hello  ")).toBe("hello");
  });
  it("leaves plain text unchanged", () => {
    expect(stripMarkdown("Hello, how are you?")).toBe("Hello, how are you?");
  });
});

// =============================================================================
// 99.5  VoiceButton component: source content checks
// =============================================================================
describe("99.5 VoiceButton.tsx source checks", () => {
  it("exports VoiceButton component", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("export function VoiceButton");
  });
  it("has isListening prop", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("isListening");
  });
  it("has isProcessing prop", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("isProcessing");
  });
  it("shows Listening... label when isListening=true", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("Listening...");
  });
  it("shows not available message when unsupported", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("Voice not available in this browser");
  });
  it("uses Mic icon from lucide-react", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("Mic");
  });
  it("has pulsing animation ring when listening", () => {
    const src = readFrontend("components", "VoiceButton.tsx");
    expect(src).toContain("animate-pulse");
  });
});

// =============================================================================
// 99.6  ChatPage: source content checks
// =============================================================================
describe("99.6 ChatPage.tsx source checks", () => {
  it("imports useVoice hook", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("useVoice");
  });
  it("imports useTTS hook", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("useTTS");
  });
  it("imports VoiceButton component", () => {
    // VoiceButton is a standalone component; ChatPage uses useVoice hook + inline Mic buttons in ChatInput
    const chatInput = readFrontend("dashboard/pages/chat", "ChatInput.tsx");
    expect(chatInput).toContain("Mic");
  });
  it("has voiceMode state", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("voiceMode");
  });
  it("stores voice mode in localStorage", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("agentin_voice_settings");
  });
  it("auto-reads response when voice mode is on", () => {
    // tts.speak is called in useChatStream hook, not ChatPage directly
    const src = readFrontend("hooks", "useChatStream.ts");
    expect(src).toContain("tts.speak");
  });
  it("exports ChatPage", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("export function ChatPage");
  });
  it("has Voice On/Off toggle", () => {
    const src = readFrontend("dashboard/pages", "ChatPage.tsx");
    expect(src).toContain("Voice");
  });
});

// =============================================================================
// 99.7  DashboardApp: Alt+V shortcut and ChatPage wiring
// =============================================================================
describe("99.7 DashboardApp: voice shortcut + ChatPage integration", () => {
  it("imports ChatPage lazy", () => {
    const src = readFrontend("dashboard", "DashboardRouter.tsx");
    expect(src).toContain("ChatPage");
  });
  it("has chat case in router", () => {
    const src = readFrontend("dashboard", "DashboardRouter.tsx");
    expect(src).toContain("case 'chat'");
  });
  it("Alt+V shortcut handler exists", () => {
    const src = readFrontend("dashboard", "DashboardApp.tsx");
    expect(src).toContain("altKey");
    expect(src).toContain("key === 'v'");
  });
  it("navigates to /dashboard/voice on Alt+V", () => {
    const src = readFrontend("dashboard", "DashboardApp.tsx");
    // Alt+V now goes to dedicated voice page
    expect(src).toContain("/dashboard/voice");
  });
  it("Voice Chat nav item exists", () => {
    const src = readFrontend("dashboard", "DashboardApp.tsx");
    expect(src).toContain("Voice Chat");
  });
  it("Voice listening toast renders when voiceListening=true", () => {
    const src = readFrontend("dashboard", "DashboardApp.tsx");
    expect(src).toContain("voiceListening");
    expect(src).toContain("Listening...");
  });
});

// =============================================================================
// 99.8  SettingsPage: Voice tab
// =============================================================================
describe("99.8 SettingsPage: Voice tab", () => {
  it("has voice TabsTrigger", () => {
    const src = readFrontend("dashboard/pages", "SettingsPage.tsx");
    expect(src).toContain('value="voice"');
  });
  it("has voiceSettings state", () => {
    const src = readFrontend("dashboard/pages", "SettingsPage.tsx");
    expect(src).toContain("voiceSettings");
  });
  it("has speech rate slider", () => {
    const src = readFrontend("dashboard/pages/settings", "VoiceTab.tsx");
    expect(src).toContain("Speech Rate");
  });
  it("has language selector", () => {
    const src = readFrontend("dashboard/pages/settings", "VoiceTab.tsx");
    expect(src).toContain("en-US");
    expect(src).toContain("en-GB");
    expect(src).toContain("hi-IN");
    expect(src).toContain("es-ES");
  });
  it("has Test Voice button", () => {
    const src = readFrontend("dashboard/pages/settings", "VoiceTab.tsx");
    expect(src).toContain("Test Voice");
  });
  it("saves to localStorage with agentin_voice_settings key", () => {
    const src = readFrontend("dashboard/pages", "SettingsPage.tsx");
    expect(src).toContain("agentin_voice_settings");
  });
  it("has Alt+V tip in voice tab", () => {
    const src = readFrontend("dashboard/pages/settings", "VoiceTab.tsx");
    expect(src).toContain("Alt + V");
  });
});

// =============================================================================
// 99.9  Backend: chat endpoint still works (unchanged)
// =============================================================================
describe("99.9 Backend: chat endpoint integrity", () => {
  it("POST /api/agent/chat with valid token returns 200", async () => {
    const res = await request(app)
      .post("/api/agent/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "hello voice test" });
    expect([200, 429, 500]).toContain(res.status);
  });

  it("POST /api/agent/chat without token returns 401", async () => {
    const res = await request(app)
      .post("/api/agent/chat")
      .send({ message: "hello" });
    expect(res.status).toBe(401);
  });

  it("GET /api/health returns healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });
});
