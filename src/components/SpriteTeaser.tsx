import { useRef, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/* ── Agent config ── */
const AGENTS = [
  { id: 'weebo', name: 'Weebo', sheet: 0, color: 'var(--ag-cyan)' },
  { id: 'edith', name: 'Edith', sheet: 1, color: 'var(--ag-violet)' },
  { id: 'jarvis', name: 'Jarvis', sheet: 2, color: '#ADFF2F' },
  { id: 'aria', name: 'Aria', sheet: 3, color: '#FF2D78' },
  { id: 'forge', name: 'Forge', sheet: 4, color: '#FFB800' },
  { id: 'pulse', name: 'Pulse', sheet: 5, color: 'var(--ag-cyan)' },
  { id: 'echo', name: 'Echo', sheet: 0, hueShift: 120, color: 'var(--ag-violet)' },
  { id: 'cal', name: 'Cal', sheet: 2, hueShift: 90, color: '#ADFF2F' },
  { id: 'nova', name: 'Nova', sheet: 3, hueShift: 180, color: '#FF2D78' },
] as const;

const FW = 16, FH = 32, SC = 3;
const DW = FW * SC, DH = FH * SC;
const CH = DH + 24;
const WALK_ROW = 2, COLS = 7, FRAME_MS = 150;
const PAD = 10;

interface WalkAgent {
  id: string; name: string; sheet: number; hueShift?: number; color: string;
  x: number; speed: number; dir: 1 | -1; frame: number;
}

export function SpriteTeaser() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<WalkAgent[]>([]);
  const sheetsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hueRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const rafRef = useRef(0);
  const visibleRef = useRef(false);
  const prefersReduced = useReducedMotion();

  const spread = useCallback((w: number) => {
    const gap = w / (AGENTS.length + 1);
    agentsRef.current = AGENTS.map((a, i) => ({
      ...a, hueShift: 'hueShift' in a ? a.hueShift : undefined,
      x: gap * (i + 1) - DW / 2,
      speed: 0.3 + Math.random() * 0.3,
      dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
      frame: Math.floor(Math.random() * COLS),
    }));
  }, []);

  useEffect(() => {
    const map = sheetsRef.current;
    const hueMap = hueRef.current;
    let loaded = 0;
    const total = 6;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function onAllLoaded() {
      const w = Math.floor(container!.getBoundingClientRect().width);
      canvas!.width = w;
      canvas!.height = CH;
      spread(w);
      if (reduced) {
        drawFrame(ctx!, w);
      } else {
        startLoop(ctx!, w);
      }
    }

    for (let i = 0; i < total; i++) {
      const key = `char_${i}`;
      if (map.has(key)) { if (++loaded >= total) onAllLoaded(); continue; }
      const img = new Image();
      img.onload = () => { map.set(key, img); if (++loaded >= total) onAllLoaded(); };
      img.onerror = () => { if (++loaded >= total) onAllLoaded(); };
      img.src = `/office/${key}.png`;
    }

    function getHue(img: HTMLImageElement, agentId: string, deg: number): HTMLCanvasElement {
      const k = `${agentId}_${deg}`;
      if (hueRef.current.has(k)) return hueRef.current.get(k)!;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      if (!cx) return c; // graceful fallback: return blank canvas
      cx.filter = `hue-rotate(${deg}deg)`;
      cx.drawImage(img, 0, 0);
      hueRef.current.set(k, c);
      return c;
    }

    /** Draw all agents at their current positions (single frame, no animation) */
    function drawFrame(c: CanvasRenderingContext2D, w: number) {
      c.clearRect(0, 0, w, CH);
      for (const a of agentsRef.current) {
        const sheet = map.get(`char_${a.sheet}`);
        if (sheet) {
          let src: HTMLImageElement | HTMLCanvasElement = sheet;
          if (a.hueShift) src = getHue(sheet, a.id, a.hueShift);
          const sx = a.frame * FW, sy = WALK_ROW * FH;
          const mirror = a.dir === -1;
          c.save();
          c.imageSmoothingEnabled = false;
          if (mirror) {
            c.translate(a.x + DW, 0);
            c.scale(-1, 1);
            c.drawImage(src, sx, sy, FW, FH, 0, 0, DW, DH);
          } else {
            c.drawImage(src, sx, sy, FW, FH, a.x, 0, DW, DH);
          }
          // Draw name label while still in save/restore scope
          c.restore();
        }
        c.font = 'bold 11px "Space Grotesk", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = a.color;
        c.fillText(a.name, a.x + DW / 2, DH + 14);
      }
    }

    let frameAccum = 0, lastT = 0;
    const reduced = prefersReduced;

    function startLoop(c: CanvasRenderingContext2D, w: number) {
      function tick(t: number) {
        if (!visibleRef.current) {
          // Paused while off-screen; schedule next check but skip work
          rafRef.current = requestAnimationFrame(tick);
          lastT = 0; // reset so dt doesn't spike when re-visible
          return;
        }

        const dt = lastT ? t - lastT : 16;
        lastT = t;
        frameAccum += dt;
        const advance = frameAccum >= FRAME_MS;
        if (advance) frameAccum -= FRAME_MS;

        c.clearRect(0, 0, w, CH);

        for (const a of agentsRef.current) {
          a.x += a.speed * a.dir;
          if (a.x < PAD) { a.dir = 1; a.x = PAD; }
          if (a.x > w - DW - PAD) { a.dir = -1; a.x = w - DW - PAD; }
          if (advance) a.frame = (a.frame + 1) % COLS;

          const sheet = map.get(`char_${a.sheet}`);
          if (sheet) {
            let src: HTMLImageElement | HTMLCanvasElement = sheet;
            if (a.hueShift) src = getHue(sheet, a.id, a.hueShift);

            const sx = a.frame * FW, sy = WALK_ROW * FH;
            const mirror = a.dir === -1;

            c.save();
            c.imageSmoothingEnabled = false;
            if (mirror) {
              c.translate(a.x + DW, 0);
              c.scale(-1, 1);
              c.drawImage(src, sx, sy, FW, FH, 0, 0, DW, DH);
            } else {
              c.drawImage(src, sx, sy, FW, FH, a.x, 0, DW, DH);
            }
            c.restore();
          }

          // Name label — no save/restore needed, just reset after
          c.font = 'bold 11px "Space Grotesk", sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillStyle = a.color;
          c.fillText(a.name, a.x + DW / 2, DH + 14);
        }

        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    // Pause animation when canvas scrolls out of viewport
    const io = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(container);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.floor(entry.contentRect.width);
      canvas!.width = w;
      canvas!.height = CH;
      spread(w);
      // Redraw static frame on resize when reduced motion
      if (reduced) drawFrame(ctx!, w);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      // Cancel any in-flight image loads and clear refs
      Array.from(map.values()).forEach(img => { img.src = ''; });
      map.clear();
      hueMap.clear();
    };
  }, [spread, prefersReduced]);

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      <div ref={containerRef} className="w-full max-w-3xl mx-auto mt-10 mb-6">
        <div
          className="relative rounded-2xl overflow-hidden border"
          style={{
            background: 'linear-gradient(145deg, rgba(12,12,24,0.7), rgba(8,8,18,0.85))',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: '0 0 40px rgba(0,240,255,0.03)',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full block"
            style={{ height: `${CH}px`, imageRendering: 'pixelated' }}
            aria-label="Preview of 9 AI agents walking around your virtual office"
            role="img"
          />
        </div>
      </div>
    </motion.div>
  );
}
