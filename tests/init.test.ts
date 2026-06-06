import { describe, it, expect } from 'vitest';

describe('Environment Init Test', () => {
  it('should basic healthcheck pass', () => {
    expect(1 + 1).toBe(2);
  });
});
