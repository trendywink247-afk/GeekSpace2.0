import { useRef, useMemo, useEffect, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';
import * as THREE from 'three';

// Types
interface HeroScene3DProps {
  mousePosRef?: RefObject<{ x: number; y: number }>;
  scrollProgressRef?: RefObject<number>;
}

// Constants -- reduced for performance (was 600/100)
const PARTICLE_COUNT = 350;
const BRAIN_RADIUS = 2.8;
const CONNECTION_DISTANCE = 0.9;
const MAX_CONNECTIONS = 60;
const MOUSE_DAMPING = 0.3;
const SCROLL_EXPAND_MAX = 0.05; // scale 1.0 to 1.05
const PULSE_CYCLE_SECONDS = 9; // slow 8-10s cycle

const COL_INNER = new THREE.Color('#8B5CF6');  // violet — inner particles
const COL_MID = new THREE.Color('#22D3EE');    // cyan — mid particles
const COL_OUTER = new THREE.Color('#F59E0B');  // gold — outer halo

// Brain surface generator
function generateBrainPositions(count: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const roll = Math.random();

    if (roll < 0.6) {
      // Brain ellipsoid -- wider than tall, two-lobed
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      const rx = BRAIN_RADIUS * 1.15;
      const ry = BRAIN_RADIUS * 0.75;
      const rz = BRAIN_RADIUS * 0.9;
      const rScale = 0.7 + Math.random() * 0.35;
      let x = rx * rScale * Math.sin(phi) * Math.cos(theta);
      const y = ry * rScale * Math.cos(phi);
      const z = rz * rScale * Math.sin(phi) * Math.sin(theta);
      const pinch = 1 + 0.25 * Math.exp(-y * y * 2);
      x *= pinch;
      pos[idx] = x + (Math.random() - 0.5) * 0.15;
      pos[idx + 1] = y + (Math.random() - 0.5) * 0.15;
      pos[idx + 2] = z + (Math.random() - 0.5) * 0.15;
    } else if (roll < 0.9) {
      // Dense core
      const r = Math.random() * BRAIN_RADIUS * 0.4;
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      pos[idx] = r * Math.sin(phi) * Math.cos(theta);
      pos[idx + 1] = r * Math.cos(phi) * 0.6;
      pos[idx + 2] = r * Math.sin(phi) * Math.sin(theta);
    } else {
      // Halo
      const r = BRAIN_RADIUS * (1.3 + Math.random() * 0.6);
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      pos[idx] = r * Math.sin(phi) * Math.cos(theta);
      pos[idx + 1] = r * Math.cos(phi) * 0.7;
      pos[idx + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
  }
  return pos;
}

// Neural network particles
function NeuralBrain({
  mousePosRef,
  scrollProgressRef,
}: {
  mousePosRef: RefObject<{ x: number; y: number }>;
  scrollProgressRef: RefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const rippleRef = useRef({ x: 999, y: 999, time: 0, active: false });

  const { basePositions, colors, sizes, connectionIndices, connectionColors } =
    useMemo(() => {
      const bPos = generateBrainPositions(PARTICLE_COUNT);
      const col = new Float32Array(PARTICLE_COUNT * 3);
      const siz = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = bPos[i * 3];
        const y = bPos[i * 3 + 1];
        const dist = Math.sqrt(x * x + y * y + bPos[i * 3 + 2] ** 2);
        const normDist = dist / (BRAIN_RADIUS * 1.9);

        const c = new THREE.Color();
        if (normDist < 0.35) {
          c.copy(COL_INNER).lerp(COL_MID, normDist / 0.35);
        } else if (normDist < 0.7) {
          c.copy(COL_MID).lerp(COL_OUTER, (normDist - 0.35) / 0.35);
        } else {
          c.copy(COL_OUTER);
          c.multiplyScalar(0.6 + Math.random() * 0.4);
        }

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;

        siz[i] = normDist < 0.4 ? 2.5 + Math.random() * 2.5 : 1 + Math.random() * 2;
      }

      // Build connections between nearby particles (max 100)
      const connIdx: number[] = [];
      const connCol: number[] = [];
      let connCount = 0;

      for (let i = 0; i < PARTICLE_COUNT && connCount < MAX_CONNECTIONS; i += 2) {
        const ax = bPos[i * 3],
          ay = bPos[i * 3 + 1],
          az = bPos[i * 3 + 2];
        for (
          let j = i + 1;
          j < Math.min(i + 40, PARTICLE_COUNT) && connCount < MAX_CONNECTIONS;
          j++
        ) {
          const dx = bPos[j * 3] - ax;
          const dy = bPos[j * 3 + 1] - ay;
          const dz = bPos[j * 3 + 2] - az;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < CONNECTION_DISTANCE) {
            connIdx.push(i, j);
            const r = (col[i * 3] + col[j * 3]) * 0.5;
            const g = (col[i * 3 + 1] + col[j * 3 + 1]) * 0.5;
            const b = (col[i * 3 + 2] + col[j * 3 + 2]) * 0.5;
            connCol.push(r, g, b, r, g, b);
            connCount++;
          }
        }
      }

      return {
        basePositions: bPos,
        colors: col,
        sizes: siz,
        connectionIndices: connIdx,
        connectionColors: new Float32Array(connCol),
      };
    }, []);

  const currentPositions = useRef(new Float32Array(basePositions));
  const linePositions = useRef(new Float32Array(connectionIndices.length * 3));

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const mx = (mousePosRef.current?.x ?? 0) * MOUSE_DAMPING;
    const my = (mousePosRef.current?.y ?? 0) * MOUSE_DAMPING;
    const scroll = scrollProgressRef.current ?? 0;

    // Subtle scroll expansion: scale 1.0 to 1.05
    const expandFactor = 1 + scroll * SCROLL_EXPAND_MAX;

    // Ripple tracking
    const ripple = rippleRef.current;
    const rpX = mx * 4;
    const rpY = -my * 3;

    const mouseDist = Math.sqrt(
      (rpX - ripple.x) ** 2 + (rpY - ripple.y) ** 2
    );
    if (mouseDist > 0.3) {
      ripple.x = rpX;
      ripple.y = rpY;
      ripple.time = t;
      ripple.active = true;
    }

    const positions = currentPositions.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      let bx = basePositions[idx];
      let by = basePositions[idx + 1];
      let bz = basePositions[idx + 2];

      // Organic breathing
      const breathe = Math.sin(t * 0.3 + i * 0.01) * 0.06;
      bx *= 1 + breathe;
      by *= 1 + breathe * 0.6;
      bz *= 1 + breathe;

      // Scroll expansion
      bx *= expandFactor;
      by *= expandFactor;
      bz *= expandFactor;

      // Ripple displacement (dampened)
      if (ripple.active) {
        const age = t - ripple.time;
        if (age < 2.5) {
          const dx = bx - ripple.x;
          const dy = by - ripple.y;
          const dist2D = Math.sqrt(dx * dx + dy * dy);
          const wavePos = age * 3;
          const distFromWave = Math.abs(dist2D - wavePos);
          if (distFromWave < 1) {
            const strength = (1 - distFromWave) * Math.exp(-age * 1.2) * 0.25;
            const norm = dist2D > 0.01 ? 1 / dist2D : 0;
            bx += dx * norm * strength;
            by += dy * norm * strength;
            bz += Math.sin(dist2D * 3 - age * 6) * strength * 0.3;
          }
        }
      }

      positions[idx] = bx;
      positions[idx + 1] = by;
      positions[idx + 2] = bz;
    }

    // Update points geometry
    const posAttr = pointsRef.current.geometry.attributes.position;
    (posAttr as THREE.BufferAttribute).set(positions);
    posAttr.needsUpdate = true;

    // Slow rotation + dampened mouse parallax
    pointsRef.current.rotation.y = t * 0.03 + mx * 0.06;
    pointsRef.current.rotation.x = Math.sin(t * 0.015) * 0.08 + my * 0.04;

    // Update connection lines
    if (linesRef.current) {
      const lPos = linePositions.current;

      for (let c = 0; c < connectionIndices.length; c += 2) {
        const aIdx = connectionIndices[c];
        const bIdx = connectionIndices[c + 1];
        const ci = (c / 2) * 6;

        lPos[ci] = positions[aIdx * 3];
        lPos[ci + 1] = positions[aIdx * 3 + 1];
        lPos[ci + 2] = positions[aIdx * 3 + 2];
        lPos[ci + 3] = positions[bIdx * 3];
        lPos[ci + 4] = positions[bIdx * 3 + 1];
        lPos[ci + 5] = positions[bIdx * 3 + 2];
      }

      const lPosAttr = linesRef.current.geometry.attributes.position;
      (lPosAttr as THREE.BufferAttribute).set(lPos);
      lPosAttr.needsUpdate = true;

      // Very subtle pulse on connection opacity
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      const pulseGlow = Math.sin(t * (2 * Math.PI / PULSE_CYCLE_SECONDS)) * 0.03;
      mat.opacity = 0.12 + pulseGlow;

      linesRef.current.rotation.copy(pointsRef.current.rotation);
    }
  });

  const linePositionArray = useMemo(() => {
    return new Float32Array(connectionIndices.length * 3);
  }, [connectionIndices.length]);

  return (
    <group>
      {/* Particle points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(basePositions), 3]}
          />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          transparent
          opacity={0.7}
          size={0.035}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Neural connections */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositionArray, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[connectionColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// Floating emissive orbs (3 max, subtle)
function FloatingOrb({
  color,
  basePosition,
  speed,
  amplitude,
  radius,
}: {
  color: string;
  basePosition: [number, number, number];
  speed: number;
  amplitude: number;
  radius: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() * speed;
    meshRef.current.position.x = basePosition[0] + Math.sin(t) * amplitude;
    meshRef.current.position.y =
      basePosition[1] + Math.cos(t * 0.7) * amplitude * 0.6;
    meshRef.current.position.z =
      basePosition[2] + Math.sin(t * 0.5) * amplitude * 0.4;
  });

  return (
    <mesh ref={meshRef} position={basePosition}>
      <sphereGeometry args={[radius, 10, 10]} />
      <meshStandardMaterial
        color={threeColor}
        emissive={threeColor}
        emissiveIntensity={1.5}
        transparent
        opacity={0.25}
        toneMapped={false}
      />
    </mesh>
  );
}

// Only 3 orbs, subtle movement
const ORBS = [
  {
    color: '#8B5CF6',
    basePosition: [3.2, 1.5, -2] as [number, number, number],
    speed: 0.15,
    amplitude: 0.5,
    radius: 0.05,
  },
  {
    color: '#22D3EE',
    basePosition: [-3, -1, 1] as [number, number, number],
    speed: 0.18,
    amplitude: 0.4,
    radius: 0.04,
  },
  {
    color: '#F59E0B',
    basePosition: [1, 2.5, -1] as [number, number, number],
    speed: 0.12,
    amplitude: 0.5,
    radius: 0.05,
  },
];

// Scene content (no holographic panels)
function SceneContent({
  mousePosRef,
  scrollProgressRef,
}: {
  mousePosRef: RefObject<{ x: number; y: number }>;
  scrollProgressRef: RefObject<number>;
}) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 5, 5]} intensity={0.15} />

      <fog attach="fog" args={['#06061a', 5, 14]} />

      <NeuralBrain
        mousePosRef={mousePosRef}
        scrollProgressRef={scrollProgressRef}
      />

      {ORBS.map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}

      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}

// Exported Canvas wrapper
export function HeroScene3D({
  mousePosRef: externalMouseRef,
  scrollProgressRef: externalScrollRef,
}: HeroScene3DProps) {
  // Internal refs used when mounted standalone (lazy-loaded without props)
  const internalMouseRef = useRef({ x: 0, y: 0 });
  const internalScrollRef = useRef(0);

  const mousePosRef = externalMouseRef ?? internalMouseRef;
  const scrollProgressRef = externalScrollRef ?? internalScrollRef;

  // Track mouse and scroll internally when no external refs are provided
  useEffect(() => {
    if (externalMouseRef && externalScrollRef) return;

    const onMouseMove = (e: MouseEvent) => {
      internalMouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      internalMouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      internalScrollRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    };

    if (!externalMouseRef) window.addEventListener('mousemove', onMouseMove, { passive: true });
    if (!externalScrollRef) window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (!externalMouseRef) window.removeEventListener('mousemove', onMouseMove);
      if (!externalScrollRef) window.removeEventListener('scroll', onScroll);
    };
  }, [externalMouseRef, externalScrollRef]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 48, near: 0.1, far: 20 }}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: true,
      }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        // Keep 3D scene dark even in light mode -- it's a visual feature
        gl.setClearColor('#06061a', 1);
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <SceneContent
        mousePosRef={mousePosRef}
        scrollProgressRef={scrollProgressRef}
      />
    </Canvas>
  );
}

export default HeroScene3D;
