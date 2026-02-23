// ============================================================
// Media Gallery - Browse all generated images/videos
// ============================================================

import { useState } from 'react';
import { 
  Video, 
  Image as ImageIcon,
  X, 
  Download, 
  Heart, 
  Trash2, 
  Grid3X3, 
  Grid2X2,
  Search,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  createdAt: string;
  isFavorite?: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    seed?: number;
  };
}

interface MediaGalleryProps {
  items?: MediaItem[];
  onDelete?: (id: string) => void;
  onFavorite?: (id: string, isFavorite: boolean) => void;
  onDownload?: (item: MediaItem) => void;
}

export function MediaGallery({ 
  items = [], 
  onDelete, 
  onFavorite, 
  onDownload 
}: MediaGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = items.filter((item) => {
    // Type filter
    if (filter === 'images' && item.type !== 'image') return false;
    if (filter === 'videos' && item.type !== 'video') return false;
    if (filter === 'favorites' && !item.isFavorite) return false;
    
    // Search filter
    if (searchQuery && !item.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const handlePrev = () => {
    const newIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
    setSelectedIndex(newIndex);
    setSelectedItem(filteredItems[newIndex]);
  };

  const handleNext = () => {
    const newIndex = (selectedIndex + 1) % filteredItems.length;
    setSelectedIndex(newIndex);
    setSelectedItem(filteredItems[newIndex]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedItem) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleNext();
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedItem(null);
        break;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#0C0C18] border border-[#00F0FF]/20 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === 'all' 
                  ? 'bg-[#00F0FF] text-white' 
                  : 'text-[#6B7280] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('images')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${
                filter === 'images' 
                  ? 'bg-[#00F0FF] text-white' 
                  : 'text-[#6B7280] hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Images
            </button>
            <button
              onClick={() => setFilter('videos')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${
                filter === 'videos' 
                  ? 'bg-[#00F0FF] text-white' 
                  : 'text-[#6B7280] hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Videos
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1 ${
                filter === 'favorites' 
                  ? 'bg-[#00F0FF] text-white' 
                  : 'text-[#6B7280] hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Favorites
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0C0C18] border border-[#00F0FF]/20 rounded-lg text-sm text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/40"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#0C0C18] border border-[#00F0FF]/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#6B7280]'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('masonry')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'masonry' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#6B7280]'
              }`}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-[#6B7280]">
        <span>{filteredItems.length} items</span>
        {searchQuery && <span>filtered by "{searchQuery}"</span>}
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#00F0FF]/10 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-[#00F0FF]" />
          </div>
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No media yet</h3>
          <p className="text-[#6B7280] max-w-sm">
            Generate your first image or video using the agent chat. They'll appear here.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          viewMode === 'grid' 
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' 
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        }`}>
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedItem(item);
                setSelectedIndex(index);
              }}
              className="group relative aspect-square bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl overflow-hidden cursor-pointer hover:border-[#00F0FF]/40 transition-all"
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.prompt}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00F0FF]/20 to-[#FF2D78]/20">
                  <Video className="w-12 h-12 text-[#00F0FF]" />
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs text-white line-clamp-2 mb-2">{item.prompt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.isFavorite && (
                        <Heart className="w-4 h-4 text-[#FF3366] fill-[#FF3366]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Type badge */}
              <div className="absolute top-2 right-2">
                <span className="px-2 py-0.5 text-xs bg-black/50 rounded-full text-white">
                  {item.type === 'image' ? '🖼️' : '🎬'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <button
            onClick={() => setSelectedItem(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation */}
          {filteredItems.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Content */}
          <div 
            className="max-w-4xl max-h-[80vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedItem.type === 'image' ? (
              <img
                src={selectedItem.url}
                alt={selectedItem.prompt}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={selectedItem.url}
                controls
                className="max-w-full max-h-[60vh] rounded-lg"
              />
            )}

            {/* Info bar */}
            <div className="w-full mt-4 p-4 glass-card-v2 rounded-xl">
              <p className="text-white mb-3">{selectedItem.prompt}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B7280]">
                  {formatDate(selectedItem.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onFavorite?.(selectedItem.id, !selectedItem.isFavorite)}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedItem.isFavorite 
                        ? 'bg-[#FF3366]/20 text-[#FF3366]' 
                        : 'bg-[#00F0FF]/20 text-[#6B7280] hover:text-[#FF3366]'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${selectedItem.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => onDownload?.(selectedItem)}
                    className="p-2 rounded-lg bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/30"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className="p-2 rounded-lg bg-[#FF3366]/20 text-[#FF3366] hover:bg-[#FF3366]/30"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-sm text-white">
            {selectedIndex + 1} / {filteredItems.length}
          </div>
        </div>
      )}
    </div>
  );
}
