// The shared 3D character. Owner: Diana.
//
// Loads character.glb (otter) and hats.glb. HatAnchor in the otter model
// is where the equipped hat attaches. Movement is code (useFrame):
//   - awake (someone moved today): bounces
//   - asleep (quiet day): slow breathing. Never sad, never sick.
//   - tap or level-up: a quick "pop"
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

const HAT_MAP = { cap: 'PropellerBeanie', crown: 'Crown', bow: 'Bow' };
const HAT_OFFSET = { cap: [0.8, -0.5, 0], crown: [0, 0, 0], bow: [0.6, 0, 0] };
const HAT_ROTATION = { cap: [0.4, 0, 0.3], crown: [0, 0, 0], bow: [0, 0, 0] };
const HAT_CAM_Z = { cap: 10, crown: 8.3, bow: 6.9 };
const BODY_SCALE = { baby: 0.72, kid: 0.86, teen: 0.98, adult: 1.08 };

function Creature({ stage, equipped, awake, popKey }) {
  const { scene: charScene } = useGLTF('/models/character.glb');
  const { nodes: hatNodes } = useGLTF('/models/hats.glb');
  const model = useMemo(() => charScene.clone(true), [charScene]);
  const root = useRef();
  const pop = useRef({ key: popKey, at: -10 });
  const size = BODY_SCALE[stage] ?? BODY_SCALE.baby;

  useEffect(() => {
    const anchor = model.getObjectByName('HatAnchor');
    if (!anchor) return;
    anchor.clear();
    const hatId = equipped.find((id) => HAT_MAP[id]);
    if (hatId) {
      const node = hatNodes[HAT_MAP[hatId]];
      if (node) {
        const clone = node.clone(true);
        clone.position.set(0, 0, 0);
        anchor.add(clone);
      }
    }
  }, [equipped, model, hatNodes]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pop.current.key !== popKey) pop.current = { key: popKey, at: t };
    const sincePop = t - pop.current.at;
    const popScale = sincePop < 0.6 ? 1 + 0.25 * Math.sin((sincePop / 0.6) * Math.PI) : 1;
    const bounce = awake ? Math.abs(Math.sin(t * 3)) * 0.18 : Math.sin(t * 1.2) * 0.03;
    const squash = awake ? 1 - Math.abs(Math.cos(t * 3)) * 0.06 : 1;
    if (root.current) {
      root.current.position.y = bounce - 0.2;
      root.current.scale.set(
        (size * popScale) / squash ** 0.5,
        size * popScale * squash,
        (size * popScale) / squash ** 0.5,
      );
      root.current.rotation.y = Math.sin(t * 0.6) * 0.25;
    }
  });

  return (
    <group scale={0.22} position={[0.05, -1.03, 0]}>
      <primitive ref={root} object={model} />
    </group>
  );
}

function HatMesh({ hatName }) {
  const { nodes } = useGLTF('/models/hats.glb');
  const clone = useMemo(() => {
    const node = nodes[hatName];
    if (!node) return null;
    const c = node.clone(true);
    c.position.set(0, 0, 0);
    return c;
  }, [nodes, hatName]);
  if (!clone) return null;
  return <primitive object={clone} />;
}

export function HatPreview({ itemId, size = 100 }) {
  const hatName = HAT_MAP[itemId];
  const offset = HAT_OFFSET[itemId] ?? [0, 0, 0];
  const rotation = HAT_ROTATION[itemId] ?? [0, 0, 0];
  const camZ = HAT_CAM_Z[itemId] ?? 10;
  if (!hatName) return null;
  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 0, camZ], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={1} />
        <directionalLight position={[20, 40, 30]} intensity={1.5} />
        <group position={offset} rotation={rotation}>
          <HatMesh hatName={hatName} />
        </group>
      </Canvas>
    </div>
  );
}

export default function Character({ stage = 'baby', equipped = [], awake = true, popKey = 0, size = 260, onTap }) {
  return (
    <div
      className="char-wrap"
      style={{ width: size, height: size }}
      onClick={onTap}
      role="img"
      aria-label={`Your club's character, ${awake ? 'awake and bouncing' : 'napping'}`}
    >
      <Canvas camera={{ position: [0, 0.3, 4.4], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} />
        <Creature stage={stage} equipped={equipped} awake={awake} popKey={popKey} />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/character.glb');
useGLTF.preload('/models/hats.glb');
