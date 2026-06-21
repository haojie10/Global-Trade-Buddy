import { describe, it, expect } from 'vitest';
import { computeTwoHopHighlight, GraphLink } from '../lib/graph-helpers';

describe('2-Hop Highlight Algorithm', () => {
  const mockLinks: GraphLink[] = [
    { source: 'A', target: 'B', relation_key: 'relation1' },
    { source: 'B', target: 'C', relation_key: 'relation2' },
    { source: 'C', target: 'D', relation_key: 'relation3' },
    { source: 'A', target: 'E', relation_key: 'relation4' },
  ];

  it('should find 1-hop and 2-hop neighbors correctly', () => {
    // When selected is A:
    // 1-hop neighbors: B, E
    // 2-hop neighbors: C (connected to B)
    // D is 3-hop (connected to C), so not highlighted
    const result = computeTwoHopHighlight('A', mockLinks);
    expect(result.highlightNodes).toContain('A');
    expect(result.highlightNodes).toContain('B');
    expect(result.highlightNodes).toContain('E');
    expect(result.highlightNodes).toContain('C');
    expect(result.highlightNodes).not.toContain('D');

    expect(result.highlightLinks).toContain('A-B');
    expect(result.highlightLinks).toContain('A-E');
    expect(result.highlightLinks).toContain('B-C');
    expect(result.highlightLinks).not.toContain('C-D');
  });

  it('should return empty sets when selectedNodeId is null', () => {
    const result = computeTwoHopHighlight(null, mockLinks);
    expect(result.highlightNodes.size).toBe(0);
    expect(result.highlightLinks.size).toBe(0);
  });
});
