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
        hue: Math.random() > 0.5 ? 168 : 330, // cyan or magenta
        life: Math.random() * maxLife,
        maxLife,
      };
    });

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

        // Aurora wave bands
        const waveY1 = canvas.height * 0.3 + Math.sin(t * 0.5) * 80;
        const waveY2 = canvas.height * 0.6 + Math.cos(t * 0.3) * 60;

        // Draw subtle aurora bands
        const auroraGrad1 = ctx.createLinearGradient(0, waveY1 - 100, 0, waveY1 + 100);
        auroraGrad1.addColorStop(0, 'transparent');
        auroraGrad1.addColorStop(0.5, 'rgba(0, 240, 255, 0.012)');
        auroraGrad1.addColorStop(1, 'transparent');
        ctx.fillStyle = auroraGrad1;
        ctx.fillRect(0, waveY1 - 100, canvas.width, 200);

        const auroraGrad2 = ctx.createLinearGradient(0, waveY2 - 80, 0, waveY2 + 80);
        auroraGrad2.addColorStop(0, 'transparent');
        auroraGrad2.addColorStop(0.5, 'rgba(255, 45, 120, 0.008)');
        auroraGrad2.addColorStop(1, 'transparent');
        ctx.fillStyle = auroraGrad2;
        ctx.fillRect(0, waveY2 - 80, canvas.width, 160);

        // Update and draw particles
        particles.forEach((p, i) => {
          p.life++;
          if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * canvas.width;
            p.y = Math.random() * canvas.height;
            p.hue = Math.random() > 0.5 ? 168 : 330;
          }

          // Organic drift with sine wave
          p.x += p.vx + Math.sin(t + i * 0.1) * 0.15;
          p.y += p.vy + Math.cos(t * 0.7 + i * 0.15) * 0.1;

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
          const isCyan = p.hue === 168;
          const color = isCyan ? `rgba(0, 240, 255, ${particleAlpha})` : `rgba(255, 45, 120, ${particleAlpha * 0.8})`;
          const glowColor = isCyan ? `rgba(0, 240, 255, ${particleAlpha * 0.15})` : `rgba(255, 45, 120, ${particleAlpha * 0.1})`;

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
                const mixCyan = p.hue === 168 || particles[j].hue === 168;
                const mixMagenta = p.hue === 330 || particles[j].hue === 330;

                let lineColor: string;
                if (mixCyan && mixMagenta) {
                  // Cross-color connection — violet tint
                  lineColor = `rgba(139, 92, 246, ${lineAlpha})`;
                } else if (mixCyan) {
                  lineColor = `rgba(0, 240, 255, ${lineAlpha})`;
                } else {
                  lineColor = `rgba(255, 45, 120, ${lineAlpha})`;
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
    ctx.fillStyle = '#06060B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ background: '#06060B' }}
    />
  );
}
