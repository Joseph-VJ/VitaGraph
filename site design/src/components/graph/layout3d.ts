export type NodeKind = "person" | "report" | "section" | "bio" | "meas" | "unc";

const TAU = Math.PI * 2;

export function layout3D(
  nodes: { id: string; k: NodeKind }[],
  edges: [string, string][],
  iters = 1200
): Record<string, [number, number, number]> {
  const R: Record<NodeKind, number> = {
    person: 0,
    report: 1.0,
    section: 1.6,
    bio: 2.15,
    meas: 2.6,
    unc: 2.7,
  };
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // deterministic
  const idx: Record<string, number> = {};
  nodes.forEach((n, i) => (idx[n.id] = i));
  const P = nodes.map((n) => {
    const u = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const q = Math.sqrt(Math.max(0, 1 - u * u));
    const r = R[n.k] ?? 0.1;
    return {
      x: q * Math.cos(a) * r,
      y: u * r,
      z: q * Math.sin(a) * r,
      vx: 0,
      vy: 0,
      vz: 0,
    };
  });

  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        // repulsion
        const a = P[i];
        const b = P[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        const d = Math.sqrt(d2);
        const f = 0.16 / d2;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        a.vz += (dz / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
        b.vz -= (dz / d) * f;
      }
    }
    for (const [ea, eb] of edges) {
      // springs, rest length 0.75
      const iA = idx[ea];
      const iB = idx[eb];
      if (iA == null || iB == null) continue;
      const A = P[iA];
      const B = P[iB];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const dz = B.z - A.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      const f = (d - 0.75) * 0.06;
      A.vx += (dx / d) * f;
      A.vy += (dy / d) * f;
      A.vz += (dz / d) * f;
      B.vx -= (dx / d) * f;
      B.vy -= (dy / d) * f;
      B.vz -= (dz / d) * f;
    }
    P.forEach((p, i) => {
      // shell attraction + integrate
      const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) + 0.001;
      const f = ((R[nodes[i].k] ?? 0.1) - d) * 0.12;
      const m = 0.06 * cool + 0.01;
      p.vx += (p.x / d) * f;
      p.vy += (p.y / d) * f;
      p.vz += (p.z / d) * f;
      p.x += p.vx * m;
      p.y += p.vy * m;
      p.z += p.vz * m;
      p.vx *= 0.55;
      p.vy *= 0.55;
      p.vz *= 0.55;
    });
  }

  const mx = Math.max(...P.map((p) => Math.hypot(p.x, p.y, p.z))) || 1; // normalise so max radius = 1
  return Object.fromEntries(
    nodes.map((n, i) => [
      n.id,
      [
        +(P[i].x / mx).toFixed(3),
        +(P[i].y / mx).toFixed(3),
        +(P[i].z / mx).toFixed(3),
      ] as [number, number, number],
    ])
  );
}
