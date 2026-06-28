import { describe, it, expect } from 'vitest';
import { generateTopology, getSelectionFactor } from '../lib/background-graph-math';

describe('Background Graph Math & Topology Tests', () => {
  it('should generate a fully connected graph topology with no isolated components', () => {
    const nodeCount = 40;
    const links = generateTopology(nodeCount);
    
    // DFS to verify all nodes are reachable from node 0 (verifying no disconnected islands)
    const adj: Record<number, number[]> = {};
    for (let i = 0; i < nodeCount; i++) adj[i] = [];
    links.forEach(l => {
      adj[l.source].push(l.target);
      adj[l.target].push(l.source);
    });
    
    const visited = new Set<number>();
    function dfs(node: number) {
      visited.add(node);
      adj[node].forEach(neighbor => {
        if (!visited.has(neighbor)) dfs(neighbor);
      });
    }
    dfs(0);
    
    expect(visited.size).toBe(nodeCount);
  });

  it('should calculate selection factors correctly and loop seamlessly at 20 seconds', () => {
    // Test selection factor interpolation and boundary values
    const factorStart = getSelectionFactor(0, 0.0);
    const factorEnd = getSelectionFactor(0, 20.0);
    expect(factorStart).toBeCloseTo(factorEnd, 5);

    // Verify node 0 is active around 2.5s
    expect(getSelectionFactor(0, 2.5)).toBe(1.0);
    expect(getSelectionFactor(0, 7.5)).toBe(0.0);
    
    // Verify cross-fade at transition point 5.0s (both node 0 and 1 are 0.5)
    expect(getSelectionFactor(0, 5.0)).toBeCloseTo(0.5, 2);
    expect(getSelectionFactor(1, 5.0)).toBeCloseTo(0.5, 2);
  });
});
