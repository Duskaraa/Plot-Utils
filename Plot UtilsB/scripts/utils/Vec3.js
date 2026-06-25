export function floorVec(v) {
  return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function regionKey(x, z, cell) {
  return `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
}

export function regionKeysForBounds(min, max, cell) {
  const keys = [];
  const x0 = Math.floor(min.x / cell);
  const x1 = Math.floor(max.x / cell);
  const z0 = Math.floor(min.z / cell);
  const z1 = Math.floor(max.z / cell);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      keys.push(`${cx},${cz}`);
    }
  }
  return keys;
}
