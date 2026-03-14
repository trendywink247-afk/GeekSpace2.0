import { useState, useEffect, useCallback } from "react";
import { Brain, Trash2, RefreshCw, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/services/api";

interface UserMemory {
  id: number; key: string; value: string; source: string;
  confidence: number; last_used: number | null; created_at: number; updated_at: number;
}

function formatTs(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function srcBadge(s: string): string {
  if(s==="manual") return "bg-cyan-500/20 text-cyan-400";
  if(s==="extracted") return "bg-green-500/20 text-green-400";
  if(s==="inferred") return "bg-purple-500/20 text-purple-400";
  return "bg-amber-500/20 text-amber-400";
}

export function MemoryPage() {
  const [memories, setMemories] = useState([] as UserMemory[]);
  const [loading, setLoading] = useState(true);
  const [apiErr, setApiErr] = useState(null as string | null);
  const [addKey, setAddKey] = useState("");
  const [addVal, setAddVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null as number | null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setApiErr(null);
    try {
      const res = await api.get("/memory");
      setMemories((res.data as {memories: UserMemory[]}).memories ?? []);
    } catch { setApiErr("Failed to load memories"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const doAdd = async () => {
    if(!addKey.trim()||!addVal.trim()) return;
    setAdding(true);
    try {
      const res = await api.post("/memory",{key:addKey.trim(),value:addVal.trim(),source:"manual"});
      const m = (res.data as {memory: UserMemory}).memory;
      setMemories(prev => { const i=prev.findIndex(x => x.key===m.key); if(i>=0){const n=[...prev];n[i]=m;return n;} return [m,...prev]; });
      setAddKey(""); setAddVal("");
    } catch { setApiErr("Failed to add memory"); }
    finally { setAdding(false); }
  };
  const doDel = async (id: number) => {
    try { await api.delete("/memory/"+String(id)); setMemories(prev => prev.filter(m => m.id!==id)); }
    catch { setApiErr("Failed to delete"); }
  };
  const doSave = async (m: UserMemory) => {
    if(!editVal.trim()) return; setSaving(true);
    try {
      const res = await api.post("/memory",{key:m.key,value:editVal.trim(),source:"manual"});
      const upd = (res.data as {memory: UserMemory}).memory;
      setMemories(prev => prev.map(x => x.id===m.id ? upd : x)); setEditId(null);
    } catch { setApiErr("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{fontFamily:"Syne,sans-serif"}}>Agent Memory</h1>
          <p className="text-[#9CA3AF]">Facts your agent remembers about you <Badge className="ml-1">{memories.length}</Badge></p>
        </div>
        <Button variant="outline" onClick={load} aria-label="Refresh memories" className="min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"><RefreshCw className="w-4 h-4" /></Button>
      </div>
      {apiErr && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{apiErr}</span>
          <button onClick={() => setApiErr(null)} className="ml-2">&times;</button>
        </div>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-[#9CA3AF] mb-3 font-medium uppercase tracking-wider">Add memory</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Key (e.g. preferred_name)" value={addKey} onChange={e => setAddKey(e.target.value)} className="flex-1" onKeyDown={e => {if(e.key==="Enter") void doAdd();}} />
            <Input placeholder="Value" value={addVal} onChange={e => setAddVal(e.target.value)} className="flex-1" onKeyDown={e => {if(e.key==="Enter") void doAdd();}} />
            <Button onClick={doAdd} disabled={adding||!addKey.trim()||!addVal.trim()} className="min-w-[80px]">
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : memories.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-16 h-16 text-[#9CA3AF] mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No memories yet</h3>
          <p className="text-[#9CA3AF] max-w-sm mx-auto">Add facts above, or your agent will extract them as you chat.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-[#9CA3AF] text-xs uppercase">
                <th className="text-left px-4 py-3">Key</th>
                <th className="text-left px-4 py-3">Value</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Source</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Last Used</th>
                <th className="px-4 py-3 w-20" />
              </tr></thead>
              <tbody>
                {memories.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-cyan-400 text-xs">{m.key}</td>
                    <td className="px-4 py-3">
                      {editId===m.id ? (
                        <div className="flex items-center gap-2">
                          <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="h-8 text-sm" autoFocus onKeyDown={e => {if(e.key==="Enter")void doSave(m);if(e.key==="Escape")setEditId(null);}} />
                          <button onClick={() => void doSave(m)} disabled={saving} className="p-1.5 rounded min-w-[44px] min-h-[44px] flex items-center justify-center bg-green-900/30 text-green-400 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Save"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-800 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Cancel"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="cursor-pointer" onClick={() => {setEditId(m.id);setEditVal(m.value);}} title="Click to edit">{m.value}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Badge className={srcBadge(m.source)}>{m.source}</Badge></td>
                    <td className="px-4 py-3 text-[#9CA3AF] text-xs hidden md:table-cell">{formatTs(m.last_used)}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end">
                      <button onClick={() => {setEditId(m.id);setEditVal(m.value);}} className="p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF] hover:text-cyan-400 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => void doDel(m.id)} className="p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF] hover:text-red-400 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}