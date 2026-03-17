// ============================================================
// Memory Page — Enhanced with stats, search, category filters,
// bulk operations, export, and knowledge graph preview
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Trash2, RefreshCw, Plus, Pencil, Check, X, Search,
  Download, Filter, Sparkles, Network, List, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/services/api";

interface UserMemory {
  id: number; key: string; value: string; source: string;
  confidence: number; last_used: number | null; created_at: number; updated_at: number;
}

type ViewMode = "list" | "graph";
type Category = "all" | "preference" | "personal" | "work" | "health" | "other";

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#00F0FF" },
  { value: "preference", label: "Preferences", color: "#8B5CF6" },
  { value: "personal", label: "Personal", color: "#FF2D78" },
  { value: "work", label: "Work", color: "#ADFF2F" },
  { value: "health", label: "Health", color: "#FFB800" },
  { value: "other", label: "Other", color: "#6B7280" },
];

function formatTs(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function srcBadge(s: string): string {
  if (s === "manual" || s === "explicit") return "bg-[#00F0FF]/10 text-[#00F0FF]";
  if (s === "extracted") return "bg-[#ADFF2F]/10 text-[#ADFF2F]";
  if (s === "inferred") return "bg-[#8B5CF6]/10 text-[#8B5CF6]";
  return "bg-amber-500/20 text-amber-400";
}
function guessCategory(key: string, value: string): Category {
  const c = `${key} ${value}`.toLowerCase();
  if (/prefer|favorite|like|love|hate|style|theme|language|mode/.test(c)) return "preference";
  if (/name|age|birthday|wife|husband|partner|family|live|born/.test(c)) return "personal";
  if (/work|job|company|role|project|team|office|meeting/.test(c)) return "work";
  if (/health|gym|diet|weight|allergy|medication|vegetarian|exercise/.test(c)) return "health";
  return "other";
}

function MemoryGraph({ memories }: { memories: UserMemory[] }) {
  const nodes = useMemo(() => {
    const map = new Map<string, { count: number; memories: UserMemory[] }>();
    for (const m of memories) {
      const cat = guessCategory(m.key, m.value);
      const e = map.get(cat);
      if (e) { e.count++; e.memories.push(m); } else { map.set(cat, { count: 1, memories: [m] }); }
    }
    return Array.from(map.entries()).map(([cat, data], i) => {
      const def = CATEGORIES.find(c => c.value === cat);
      const angle = (i / map.size) * Math.PI * 2;
      return { id: cat, label: def?.label ?? cat, color: def?.color ?? "#6B7280", count: data.count, memories: data.memories, cx: 200 + 120 * Math.cos(angle), cy: 180 + 120 * Math.sin(angle), r: Math.min(20 + data.count * 4, 50) };
    });
  }, [memories]);

  const [hovered, setHovered] = useState<string | null>(null);
  const hovMems = nodes.find(n => n.id === hovered)?.memories ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 400 360" className="w-full max-w-[400px]">
          <circle cx="200" cy="180" r="30" fill="#00F0FF" opacity={0.15} stroke="#00F0FF" strokeWidth={1} />
          <text x="200" y="184" textAnchor="middle" fill="#00F0FF" fontSize="11" fontWeight="bold">You</text>
          {nodes.map(n => (
            <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <line x1={200} y1={180} x2={n.cx} y2={n.cy} stroke={hovered === n.id ? n.color : "rgba(255,255,255,0.1)"} strokeWidth={hovered === n.id ? 2 : 1} strokeDasharray={hovered === n.id ? undefined : "4 4"} />
              <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.color} opacity={hovered === n.id ? 0.3 : 0.15} stroke={n.color} strokeWidth={hovered === n.id ? 2 : 1} />
              <text x={n.cx} y={n.cy - n.r - 6} textAnchor="middle" fill={n.color} fontSize="10" fontWeight="500">{n.label}</text>
              <text x={n.cx} y={n.cy + 4} textAnchor="middle" fill="#F4F6FF" fontSize="12" fontWeight="bold">{n.count}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="lg:w-72 space-y-2">
        {hovered ? (
          <>
            <h3 className="text-sm font-medium text-[#F4F6FF]">{nodes.find(n => n.id === hovered)?.label} ({hovMems.length})</h3>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {hovMems.slice(0, 10).map(m => (
                <div key={m.id} className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                  <span className="text-[#00F0FF] font-mono">{m.key}</span>
                  <span className="text-[#8892A4] mx-1">=</span>
                  <span className="text-[#F4F6FF]">{m.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-sm text-[#8892A4]">Hover a node to see memories.</p>}
      </div>
    </div>
  );
}

export function MemoryPage() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [addKey, setAddKey] = useState("");
  const [addVal, setAddVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setApiErr(null);
    try {
      const res = await api.get("/memory");
      setMemories((res.data as { memories: UserMemory[] }).memories ?? []);
    } catch { setApiErr("Failed to load memories"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const manual = memories.filter(m => m.source === "manual" || m.source === "explicit").length;
    const extracted = memories.filter(m => m.source === "extracted").length;
    const inferred = memories.filter(m => m.source === "inferred").length;
    return { total: memories.length, manual, extracted, inferred };
  }, [memories]);

  const filtered = useMemo(() => {
    let result = memories;
    if (searchQ.trim()) { const q = searchQ.toLowerCase(); result = result.filter(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)); }
    if (category !== "all") result = result.filter(m => guessCategory(m.key, m.value) === category);
    return result;
  }, [memories, searchQ, category]);

  const doAdd = async () => {
    if (!addKey.trim() || !addVal.trim()) return;
    setAdding(true);
    try {
      const res = await api.post("/memory", { key: addKey.trim(), value: addVal.trim(), source: "manual" });
      const m = (res.data as { memory: UserMemory }).memory;
      setMemories(prev => { const i = prev.findIndex(x => x.key === m.key); if (i >= 0) { const n = [...prev]; n[i] = m; return n; } return [m, ...prev]; });
      setAddKey(""); setAddVal("");
    } catch { setApiErr("Failed to add memory"); }
    finally { setAdding(false); }
  };
  const doDel = async (id: number) => {
    try { await api.delete("/memory/" + String(id)); setMemories(prev => prev.filter(m => m.id !== id)); selected.delete(id); }
    catch { setApiErr("Failed to delete"); }
  };
  const doBulkDel = async () => { for (const id of selected) await doDel(id); setSelected(new Set()); setBulkMode(false); };
  const doSave = async (m: UserMemory) => {
    if (!editVal.trim()) return; setSaving(true);
    try {
      const res = await api.post("/memory", { key: m.key, value: editVal.trim(), source: "manual" });
      const upd = (res.data as { memory: UserMemory }).memory;
      setMemories(prev => prev.map(x => x.id === m.id ? upd : x)); setEditId(null);
    } catch { setApiErr("Failed to save"); }
    finally { setSaving(false); }
  };
  const doExport = () => {
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `agentin-memories-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2" style={{ fontFamily: "Syne,sans-serif" }}><Brain className="w-7 h-7 text-[#00F0FF]" />Agent Memory</h1>
          <p className="text-[#9CA3AF]">Facts your agent remembers about you</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0C0C18] border border-white/10 rounded-lg p-0.5">
            <button onClick={() => setViewMode("list")} className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-[#00F0FF]/20 text-[#00F0FF]" : "text-[#8892A4] hover:text-[#F4F6FF]"}`} aria-label="List view"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("graph")} className={`p-2 rounded-md transition-colors ${viewMode === "graph" ? "bg-[#00F0FF]/20 text-[#00F0FF]" : "text-[#8892A4] hover:text-[#F4F6FF]"}`} aria-label="Graph view"><Network className="w-4 h-4" /></button>
          </div>
          <Button variant="outline" size="sm" onClick={doExport} disabled={memories.length === 0} className="min-h-[44px]"><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button variant="outline" onClick={load} aria-label="Refresh" className="min-w-[44px] min-h-[44px]"><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ label: "Total", value: stats.total, color: "#F4F6FF" }, { label: "Manual", value: stats.manual, color: "#00F0FF" }, { label: "Extracted", value: stats.extracted, color: "#ADFF2F" }, { label: "Inferred", value: stats.inferred, color: "#8B5CF6" }].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-[#0C0C18] border border-white/5">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[#8892A4]">{s.label}</div>
          </div>
        ))}
      </div>

      {apiErr && <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm flex items-center justify-between"><span>{apiErr}</span><button onClick={() => setApiErr(null)}>&times;</button></div>}

      {/* Quick add */}
      <Card className="border-[#00F0FF]/10"><CardContent className="p-4">
        <p className="text-xs text-[#8892A4] mb-3 font-medium uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-3 h-3" />Add memory</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Key (e.g. preferred_name)" value={addKey} onChange={e => setAddKey(e.target.value)} className="flex-1 bg-[#0C0C18] border-[#00F0FF]/10 focus:border-[#00F0FF]" onKeyDown={e => { if (e.key === "Enter") void doAdd(); }} />
          <Input placeholder="Value" value={addVal} onChange={e => setAddVal(e.target.value)} className="flex-1 bg-[#0C0C18] border-[#00F0FF]/10 focus:border-[#00F0FF]" onKeyDown={e => { if (e.key === "Enter") void doAdd(); }} />
          <Button onClick={doAdd} disabled={adding || !addKey.trim() || !addVal.trim()} className="min-w-[80px]">{adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add</>}</Button>
        </div>
      </CardContent></Card>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" /><Input placeholder="Search memories..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-10 bg-[#0C0C18] border-white/10 focus:border-[#00F0FF]" /></div>
        <div className="flex gap-1.5 flex-wrap">{CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => setCategory(cat.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${category === cat.value ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30" : "bg-white/5 text-[#8892A4] border border-transparent hover:bg-white/10"}`}>{cat.label}</button>
        ))}</div>
      </div>

      {/* Bulk mode */}
      {memories.length > 0 && <div className="flex items-center gap-3">
        <button onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }} className="text-xs text-[#8892A4] hover:text-[#00F0FF] flex items-center gap-1"><Filter className="w-3 h-3" />{bulkMode ? "Cancel" : "Select multiple"}</button>
        {bulkMode && selected.size > 0 && <Button variant="destructive" size="sm" onClick={doBulkDel} className="text-xs h-7"><Trash2 className="w-3 h-3 mr-1" />Delete {selected.size}</Button>}
      </div>}

      {/* Content */}
      {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>
      : memories.length === 0 ? (
        <div className="text-center py-16 space-y-5">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-2xl bg-[#00F0FF]/8 border border-[#00F0FF]/15 flex items-center justify-center animate-pulse">
              <Brain className="w-10 h-10 text-[#00F0FF]/50" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ADFF2F]/15 border border-[#ADFF2F]/30 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-[#ADFF2F]" />
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#F4F6FF]">No memories yet</h3>
            <p className="text-[#8892A4] text-sm max-w-xs mx-auto leading-relaxed">
              Your AI remembers everything you teach it. Start a conversation to build your memory.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/dashboard/chat")}
              className="bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/25 min-h-[44px] px-6"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
            <p className="text-xs text-[#8892A4]">or add a memory manually above</p>
          </div>
        </div>
      )
      : viewMode === "graph" ? <Card className="border-[#00F0FF]/10"><CardContent className="p-6"><MemoryGraph memories={memories} /></CardContent></Card>
      : <>
        <p className="text-xs text-[#8892A4]">{filtered.length} of {memories.length} memories{searchQ && ` matching "${searchQ}"`}</p>
        <div className="space-y-2">{filtered.map(m => {
          const cat = guessCategory(m.key, m.value);
          const def = CATEGORIES.find(c => c.value === cat);
          return (
            <Card key={m.id} className={`border-white/5 hover:border-white/15 transition-all ${selected.has(m.id) ? "ring-1 ring-[#00F0FF]/50" : ""}`}>
              <CardContent className="p-4"><div className="flex items-start gap-3">
                {bulkMode && <input type="checkbox" checked={selected.has(m.id)} onChange={() => { const s = new Set(selected); if (s.has(m.id)) s.delete(m.id); else s.add(m.id); setSelected(s); }} className="mt-1 w-4 h-4 accent-[#00F0FF]" />}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: def?.color ?? "#6B7280" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-[#00F0FF]">{m.key}</span>
                    <Badge className={`text-[10px] ${srcBadge(m.source)}`}>{m.source}</Badge>
                    <span className="text-[10px] text-[#6B7280]">{def?.label}</span>
                  </div>
                  {editId === m.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="h-8 text-sm bg-[#0C0C18] border-[#00F0FF]/10" autoFocus onKeyDown={e => { if (e.key === "Enter") void doSave(m); if (e.key === "Escape") setEditId(null); }} />
                      <button onClick={() => void doSave(m)} disabled={saving} className="p-2 rounded bg-green-900/30 text-green-400 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="p-2 rounded bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Cancel"><X className="w-4 h-4" /></button>
                    </div>
                  ) : <p className="text-sm text-[#F4F6FF]">{m.value}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6B7280]">
                    <span>Created {formatTs(m.created_at)}</span>
                    {m.last_used && <span>Last used {formatTs(m.last_used)}</span>}
                    {m.confidence < 1 && <span>Confidence: {Math.round(m.confidence * 100)}%</span>}
                  </div>
                </div>
                {!bulkMode && <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditId(m.id); setEditVal(m.value); }} className="p-2 rounded text-[#8892A4] hover:text-[#00F0FF] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => void doDel(m.id)} className="p-2 rounded text-[#8892A4] hover:text-[#FF2D78] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>}
              </div></CardContent>
            </Card>
          );
        })}</div>
      </>}
    </div>
  );
}
