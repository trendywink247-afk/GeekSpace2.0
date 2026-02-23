// ============================================================
// Memory Manager - Search, browse, and manage agent memories
// ============================================================

import { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Trash2,
  Clock,
  Tag,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { memoryService } from '@/services/api';

interface MemoryEntry {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export function MemoryManagerPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'confidence' | 'accessed'>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load memories from API
  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const { data } = await memoryService.list();
      setMemories(data);
    } catch {
      // API failed — show empty state
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await memoryService.delete(id);
    } catch {
      // non-fatal — still remove from UI
    }
    setMemories(memories.filter((m) => m.id !== id));
  };

  const handleDeleteByCategory = async (category: string) => {
    if (!confirm(`Delete all memories in category "${category}"?`)) return;
    
    const toDelete = memories.filter((m) => m.category === category);
    for (const memory of toDelete) {
      await handleDelete(memory.id);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(memories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geekspace-memories-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter and sort memories
  const filteredMemories = memories
    .filter((m) => {
      const matchesSearch = 
        m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'confidence':
          return b.confidence - a.confidence;
        case 'accessed':
          return b.accessCount - a.accessCount;
        default:
          return 0;
      }
    });

  // Get unique categories
  const categories = ['all', ...new Set(memories.map((m) => m.category))];

  // Stats
  const stats = {
    total: memories.length,
    categories: new Set(memories.map((m) => m.category)).size,
    avgConfidence: memories.length > 0 
      ? (memories.reduce((a, m) => a + m.confidence, 0) / memories.length * 100).toFixed(0)
      : 0,
    thisWeek: memories.filter((m) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(m.createdAt) > weekAgo;
    }).length,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Memory Manager
          </h1>
          <p className="text-[#6B7280]">
            {stats.total} memories across {stats.categories} categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} className="border-[#00F0FF]/30">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadMemories} variant="outline" className="border-[#00F0FF]/30">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{stats.total}</div>
                <div className="text-xs text-[#6B7280]">Total Memories</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00FF88]/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#00FF88]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{stats.categories}</div>
                <div className="text-xs text-[#6B7280]">Categories</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#FFB800]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{stats.avgConfidence}%</div>
                <div className="text-xs text-[#6B7280]">Avg Confidence</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2D78]/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#FF2D78]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{stats.thisWeek}</div>
                <div className="text-xs text-[#6B7280]">This Week</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-[#00F0FF]/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#06060B] border-[#00F0FF]/20"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-[#E8E8F0] text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-[#E8E8F0] text-sm"
              >
                <option value="recent">Most Recent</option>
                <option value="confidence">Highest Confidence</option>
                <option value="accessed">Most Accessed</option>
              </select>
            </div>
          </div>

          {/* Category quick filters */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.filter(c => c !== 'all').map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#00F0FF] text-white'
                      : 'bg-[#06060B] text-[#6B7280] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memories List */}
      {filteredMemories.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-16 h-16 text-[#00F0FF]/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No memories found</h3>
          <p className="text-[#6B7280] max-w-sm mx-auto">
            Your agent will build memories as you chat. They'll appear here for you to review and manage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMemories.map((memory) => (
            <Card
              key={memory.id}
              className="bg-[#0C0C18] border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Confidence indicator */}
                  <div className="flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: `${memory.confidence > 0.8 ? '#00FF88' : memory.confidence > 0.5 ? '#FFB800' : '#FF6161'}20`,
                        color: memory.confidence > 0.8 ? '#00FF88' : memory.confidence > 0.5 ? '#FFB800' : '#FF6161',
                      }}
                    >
                      {(memory.confidence * 100).toFixed(0)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-[#00F0FF]/20 text-[#00F0FF]">
                            {memory.category}
                          </Badge>
                          <span className="text-xs text-[#6B7280]">
                            {memory.accessCount} accesses
                          </span>
                        </div>
                        
                        <h4 className="font-medium text-[#E8E8F0] mb-1">{memory.key}</h4>
                        
                        {expandedId === memory.id ? (
                          <p className="text-sm text-[#6B7280] whitespace-pre-wrap">{memory.value}</p>
                        ) : (
                          <p className="text-sm text-[#6B7280] line-clamp-2">{memory.value}</p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-[#6B7280]">
                          <span>Created: {formatDate(memory.createdAt)}</span>
                          <span>Updated: {formatDate(memory.updatedAt)}</span>
                          <span>Source: {memory.source}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                          className="p-2 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-white transition-colors"
                        >
                          {expandedId === memory.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(memory.id)}
                          className="p-2 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#FF6161] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedCategory !== 'all' && memories.some(m => m.category === selectedCategory) && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => handleDeleteByCategory(selectedCategory)}
            className="border-[#FF6161]/30 text-[#FF6161] hover:bg-[#FF6161]/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete all in {selectedCategory}
          </Button>
        </div>
      )}
    </div>
  );
}
