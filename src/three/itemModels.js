// Which 3D node each shop item uses. Owner: Diana.
// Every id in src/lib/items.js needs an entry here (npm test checks it).
//   node:     object name inside public/models/hats.glb
//   offset, rotation, camZ: framing for the small Shop preview
export const ITEM_MODELS = {
  cap: { node: 'PropellerBeanie', offset: [0.8, -0.5, 0], rotation: [0.4, 0, 0.3], camZ: 10 },
  bow: { node: 'Bow', offset: [0.6, 0, 0], rotation: [0, 0, 0], camZ: 6.9 },
  crown: { node: 'Crown', offset: [0, 0, 0], rotation: [0, 0, 0], camZ: 8.3 },
};
