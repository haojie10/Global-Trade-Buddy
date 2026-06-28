export interface Link {
  source: number;
  target: number;
  relationType: 'competitor' | 'supplier' | 'operation' | 'mention';
}

// Seeded random number generator
let seed = 450;
function random(): number {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate connected topology using Spanning Tree + Extra links
export function generateTopology(nodeCount: number): Link[] {
  const links: Link[] = [];
  const relationTypes: Link['relationType'][] = ['competitor', 'supplier', 'operation', 'mention'];

  // 1. Spanning Tree to guarantee connectedness
  for (let i = 1; i < nodeCount; i++) {
    const target = Math.floor(random() * i);
    links.push({
      source: i,
      target,
      relationType: relationTypes[Math.floor(random() * 4)]
    });
  }

  // 2. Extra links
  for (let k = 0; k < 30; k++) {
    const source = Math.floor(random() * nodeCount);
    let target = Math.floor(random() * nodeCount);
    while (source === target) {
      target = Math.floor(random() * nodeCount);
    }
    const exists = links.some(l => (l.source === source && l.target === target) || (l.source === target && l.target === source));
    if (!exists) {
      links.push({
        source,
        target,
        relationType: relationTypes[Math.floor(random() * 4)]
      });
    }
  }
  return links;
}

// Modulo 20s selection factor selector (0s-5s: Node 0, 5s-10s: Node 1, 10s-15s: Node 2, 15s-20s: Node 3)
export function getSelectionFactor(selIndex: number, t: number): number {
  if (selIndex < 0) return 0;
  const center = selIndex * 5 + 2.5;
  
  let diff = Math.abs(t - center);
  if (diff > 10) {
    diff = 20 - diff;
  }
  
  if (diff <= 2.0) return 1.0;
  if (diff >= 3.0) return 0.0;
  return 1.0 - (diff - 2.0);
}
