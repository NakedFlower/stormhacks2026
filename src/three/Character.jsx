// The shared 3D character. Owner: Diana.
//
// Right now the body is built from simple shapes, so the app works before the
// Blender model is ready. Movement is code, not animation (useFrame):
//   - awake (someone moved today): bounces
//   - asleep (quiet day): slow breathing, eyes closed. Never sad, never sick.
//   - tap or level-up: a quick "pop"
//
// Swapping in the GLB later: keep the three anchor groups below. In Blender, add
// empties named anchor_head, anchor_face, anchor_body; the add-ons attach to them
// by name, exactly like the placeholder add-ons do here.
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

const BODY = { baby: 0.72, kid: 0.86, teen: 0.98, adult: 1.08 };
const COLORS = { body: '#5b93ea', belly: '#dbe8fc', pink: '#e0569b', yellow: '#f2c230', dark: '#1d2433' };

function Addons({ equipped, slot }) {
  const has = (id) => equipped.includes(id);
  if (slot === 'head') {
    return (
      <>
        {has('cap') && (
          <group>
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={COLORS.pink} /></mesh>
            <mesh position={[0, 0.08, 0.42]} rotation={[0.15, 0, 0]}><boxGeometry args={[0.6, 0.05, 0.4]} /><meshStandardMaterial color={COLORS.pink} /></mesh>
          </group>
        )}
        {has('headband') && (
          <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.07, 12, 40]} /><meshStandardMaterial color={COLORS.pink} /></mesh>
        )}
        {has('bow') && (
          <group position={[0.35, 0.1, 0.1]}>
            <mesh position={[-0.12, 0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color={COLORS.pink} /></mesh>
            <mesh position={[0.12, 0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial color={COLORS.pink} /></mesh>
          </group>
        )}
        {has('crown') && (
          <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.32, 0.28, 0.26, 8, 1, true]} /><meshStandardMaterial color={COLORS.yellow} metalness={0.6} roughness={0.25} side={2} /></mesh>
        )}
      </>
    );
  }
  if (slot === 'face' && has('sunglasses')) {
    return (
      <group>
        <mesh position={[-0.22, 0, 0]}><boxGeometry args={[0.32, 0.2, 0.06]} /><meshStandardMaterial color={COLORS.dark} /></mesh>
        <mesh position={[0.22, 0, 0]}><boxGeometry args={[0.32, 0.2, 0.06]} /><meshStandardMaterial color={COLORS.dark} /></mesh>
        <mesh><boxGeometry args={[0.14, 0.04, 0.04]} /><meshStandardMaterial color={COLORS.dark} /></mesh>
      </group>
    );
  }
  if (slot === 'body') {
    return (
      <>
        {has('jacket') && (
          <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[0.93, 0.98, 0.7, 32, 1, true]} /><meshStandardMaterial color={COLORS.pink} side={2} /></mesh>
        )}
        {has('scarf') && (
          <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.78, 0.12, 12, 40]} /><meshStandardMaterial color={COLORS.yellow} /></mesh>
        )}
      </>
    );
  }
  return null;
}

function Creature({ stage, equipped, awake, popKey }) {
  const root = useRef();
  const eyes = useRef([]);
  const aura = useRef();
  const pop = useRef({ key: popKey, at: -10 });
  const size = BODY[stage] ?? BODY.baby;
  const grown = stage !== 'baby';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pop.current.key !== popKey) pop.current = { key: popKey, at: t };
    const sincePop = t - pop.current.at;
    const popScale = sincePop < 0.6 ? 1 + 0.25 * Math.sin((sincePop / 0.6) * Math.PI) : 1;
    const bounce = awake ? Math.abs(Math.sin(t * 3)) * 0.18 : Math.sin(t * 1.2) * 0.03;
    const squash = awake ? 1 - Math.abs(Math.cos(t * 3)) * 0.06 : 1;
    if (root.current) {
      root.current.position.y = bounce - 0.2;
      root.current.scale.set(size * popScale / squash ** 0.5, size * popScale * squash, size * popScale / squash ** 0.5);
      root.current.rotation.y = Math.sin(t * 0.6) * 0.25;
    }
    const blink = awake && t % 4 < 0.12 ? 0.1 : 1;
    eyes.current.forEach((e) => e && e.scale.set(1, awake ? blink : 0.15, 1));
    if (aura.current) aura.current.rotation.z = t * 0.8;
  });

  return (
    <group ref={root}>
      <mesh><sphereGeometry args={[1, 48, 48]} /><meshStandardMaterial color={COLORS.body} roughness={0.55} /></mesh>
      <mesh position={[0, -0.25, 0.62]} scale={[0.6, 0.55, 0.4]}><sphereGeometry args={[1, 32, 32]} /><meshStandardMaterial color={COLORS.belly} /></mesh>
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={x} ref={(el) => { eyes.current[i] = el; }} position={[x, 0.25, 0.88]}><sphereGeometry args={[0.1, 16, 16]} /><meshStandardMaterial color={COLORS.dark} /></mesh>
      ))}
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.78]} scale={[1, 0.6, 0.4]}><sphereGeometry args={[0.12, 16, 16]} /><meshStandardMaterial color={COLORS.pink} transparent opacity={0.7} /></mesh>
      ))}
      {grown && [-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, -0.95, 0.15]} scale={[1, 0.6, 1.2]}><sphereGeometry args={[0.24, 16, 16]} /><meshStandardMaterial color={COLORS.body} /></mesh>
      ))}
      {(stage === 'teen' || stage === 'adult') && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.98, -0.15, 0.1]} rotation={[0, 0, s * 0.5]} scale={[0.5, 1, 0.5]}><sphereGeometry args={[0.28, 16, 16]} /><meshStandardMaterial color={COLORS.body} /></mesh>
      ))}

      <group name="anchor_head" position={[0, 0.82, 0]}><Addons equipped={equipped} slot="head" /></group>
      <group name="anchor_face" position={[0, 0.25, 0.95]}><Addons equipped={equipped} slot="face" /></group>
      <group name="anchor_body" position={[0, 0, 0]}><Addons equipped={equipped} slot="body" /></group>

      {equipped.includes('aura') && (
        <mesh ref={aura} position={[0, 0, -0.4]}><torusGeometry args={[1.35, 0.05, 8, 60]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.8} /></mesh>
      )}
    </group>
  );
}

export default function Character({ stage = 'baby', equipped = [], awake = true, popKey = 0, size = 260, onTap }) {
  return (
    <div className="char-wrap" style={{ width: size, height: size }} onClick={onTap} role="img"
      aria-label={`Your club's character, ${awake ? 'awake and bouncing' : 'napping'}`}>
      <Canvas camera={{ position: [0, 0.3, 4.4], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} />
        <Creature stage={stage} equipped={equipped} awake={awake} popKey={popKey} />
      </Canvas>
    </div>
  );
}
