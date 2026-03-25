import { useState, useEffect } from 'react';

const agents = [
  { name: 'Weebo', color: '#10B981', message: 'Ready to assist you today!' },
  { name: 'Edith', color: '#8B5CF6', message: "I've organized your schedule." },
  { name: 'Jarvis', color: '#F59E0B', message: 'Your systems are running smoothly.' },
];

const keyframes = `
@keyframes agentBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
`;

type Phase = 'typing' | 'showing' | 'fading';

export function AgentChatBubble() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');

  useEffect(() => {
    const agent = agents[index];
    if (!agent) return;

    // typing → showing after 1.5s
    const t1 = setTimeout(() => setPhase('showing'), 1500);
    // showing → fading after 1.5 + 3 = 4.5s
    const t2 = setTimeout(() => setPhase('fading'), 4500);
    // fading → next agent after 4.5 + 0.4 = 4.9s
    const t3 = setTimeout(() => {
      setIndex((i) => (i + 1) % agents.length);
      setPhase('typing');
    }, 4900);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [index]);

  const agent = agents[index];
  const bubbleOpacity = phase === 'fading' ? 0 : 1;

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="inline-flex"
        style={{
          transition: 'opacity 0.4s ease',
          opacity: bubbleOpacity,
        }}
      >
        <div
          className="rounded-2xl px-4 py-2.5 flex flex-col gap-1"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Agent name row */}
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: agent.color,
                boxShadow: `0 0 6px ${agent.color}`,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: agent.color }}
            >
              {agent.name}
            </span>
          </div>

          {/* Typing dots / message */}
          <div style={{ minHeight: 20, position: 'relative' }}>
            {/* Typing dots */}
            <div
              className="flex items-center gap-1"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transition: 'opacity 0.3s ease',
                opacity: phase === 'typing' ? 1 : 0,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.5)',
                    display: 'inline-block',
                    animation: `agentBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* Message text */}
            <p
              className="text-sm"
              style={{
                color: 'rgba(255,255,255,0.7)',
                margin: 0,
                whiteSpace: 'nowrap',
                transition: 'opacity 0.3s ease',
                opacity: phase === 'showing' || phase === 'fading' ? 1 : 0,
              }}
            >
              {agent.message}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
