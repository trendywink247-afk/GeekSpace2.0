import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  life: number;
  maxLife: number;
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const timeRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles — dual-color aurora system
    const particleCount = Math.min(60, Math.floor((canvas.width * canvas.height) / 25000));
    particlesRef.current = Array.from({ length: particleCount }, () => {
      const maxLife = 300 + Math.random() * 400;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 2.5 + 1.5,
        hue: (() => { const r = Math.random(); return r < 0.6 ? 263 : r < 0.9 ? 160 : 40; })(), // 60% violet, 30% emerald, 10% gold
        life: Math.random() * maxLife,
        maxLife,
      };
    });

    // Mouse tracking for particle repulsion
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    canvas.style.pointerEvents = 'auto';
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let frameCount = 0;

    const animate = () => {
      frameCount++;
      timeRef.current += 0.008;

      if (frameCount % 2 === 0) {
        // Semi-transparent clear for trails
        ctx.fillStyle = 'rgba(3, 3, 4, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const particles = particlesRef.current;
        const connectionDistance = 140;
        const t = timeRef.current;

        // Aurora wave bands — shift more noticeably with time
        const waveY1 = canvas.height * 0.3 + Math.sin(t * 0.7) * 100;
        const waveY2 = canvas.height * 0.6 + Math.cos(t * 0.5) * 80;
        const waveY3 = canvas.height * 0.45 + Math.sin(t * 0.4 + 1.5) * 90;

        // Draw vivid aurora bands
        const auroraGrad1 = ctx.createLinearGradient(0, waveY1 - 120, 0, waveY1 + 120);
        auroraGrad1.addColorStop(0, 'transparent');
        auroraGrad1.addColorStop(0.5, 'rgba(139, 92, 246, 0.05)');
        auroraGrad1.addColorStop(1, 'transparent');
        ctx.fillStyle = auroraGrad1;
        ctx.fillRect(0, waveY1 - 120, canvas.width, 240);

        const auroraGrad2 = ctx.createLinearGradient(0, waveY2 - 100, 0, waveY2 + 100);
        auroraGrad2.addColorStop(0, 'transparent');
        auroraGrad2.addColorStop(0.5, 'rgba(34, 211, 238, 0.05)');
        auroraGrad2.addColorStop(1, 'transparent');
        ctx.fillStyle = auroraGrad2;
        ctx.fillRect(0, waveY2 - 100, canvas.width, 200);

        const auroraGrad3 = ctx.createLinearGradient(0, waveY3 - 90, 0, waveY3 + 90);
        auroraGrad3.addColorStop(0, 'transparent');
        auroraGrad3.addColorStop(0.5, 'rgba(245, 158, 11, 0.03)');
        auroraGrad3.addColorStop(1, 'transparent');
        ctx.fillStyle = auroraGrad3;
        ctx.fillRect(0, waveY3 - 90, canvas.width, 180);

        // Update and draw particles
        particles.forEach((p, i) => {
          p.life++;
          if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * canvas.width;
            p.y = Math.random() * canvas.height;
            const r = Math.random(); p.hue = r < 0.6 ? 263 : r < 0.9 ? 160 : 40;
          }

          // Mouse repulsion — gentle push within 150px
          const mouse = mouseRef.current;
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          let repulseX = 0;
          let repulseY = 0;
          if (mDist < 150 && mDist > 0) {
            const force = (1 - mDist / 150) * 0.8;
            repulseX = (mdx / mDist) * force;
            repulseY = (mdy / mDist) * force;
          }

          // Organic drift with sine wave + mouse repulsion
          p.x += p.vx + Math.sin(t + i * 0.1) * 0.15 + repulseX;
          p.y += p.vy + Math.cos(t * 0.7 + i * 0.15) * 0.1 + repulseY;

          // Wrap around edges
          if (p.x < -10) p.x = canvas.width + 10;
          if (p.x > canvas.width + 10) p.x = -10;
          if (p.y < -10) p.y = canvas.height + 10;
          if (p.y > canvas.height + 10) p.y = -10;

          // Fade based on life cycle
          const lifeFrac = p.life / p.maxLife;
          const alpha = lifeFrac < 0.1 ? lifeFrac * 10 : lifeFrac > 0.8 ? (1 - lifeFrac) * 5 : 1;
          const particleAlpha = alpha * 0.6;

          // Draw particle with glow
          const isViolet = p.hue === 263;
          const isGold = p.hue === 40;
          const color = isViolet ? `rgba(139, 92, 246, ${particleAlpha})` : isGold ? `rgba(245, 158, 11, ${particleAlpha * 0.9})` : `rgba(34, 211, 238, ${particleAlpha * 0.8})`;
          const glowColor = isViolet ? `rgba(139, 92, 246, ${particleAlpha * 0.15})` : isGold ? `rgba(245, 158, 11, ${particleAlpha * 0.12})` : `rgba(34, 211, 238, ${particleAlpha * 0.1})`;

          // Glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();

          // Core
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Draw connections
          if (i % 2 === 0) {
            for (let j = i + 1; j < particles.length; j += 2) {
              const dx = particles[j].x - p.x;
              const dy = particles[j].y - p.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < connectionDistance) {
                const lineAlpha = (1 - distance / connectionDistance) * 0.15 * alpha;
                const hasViolet = p.hue === 263 || particles[j].hue === 263;
                const hasGold = p.hue === 40 || particles[j].hue === 40;

                let lineColor: string;
                if (hasGold) {
                  lineColor = `rgba(245, 158, 11, ${lineAlpha})`;
                } else if (hasViolet) {
                  lineColor = `rgba(139, 92, 246, ${lineAlpha})`;
                } else {
                  lineColor = `rgba(34, 211, 238, ${lineAlpha})`;
                }

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 0.6;
                ctx.stroke();
              }
            }
          }
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Initial full clear
    ctx.fillStyle = '#06061a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: '#06061a' }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.03), transparent 70%)',
      }} />
    </div>
  );
}
