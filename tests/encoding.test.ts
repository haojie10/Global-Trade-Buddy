import { describe, it, expect } from 'vitest';
import { detectAndDecodeHtml } from '../lib/encoding';

describe('detectAndDecodeHtml utility', () => {
  it('should correctly decode UTF-8 binary array', () => {
    // "Hello, 世界" 的 UTF-8 编码字节流
    const utf8Bytes = new Uint8Array([72, 101, 108, 108, 111, 44, 32, 228, 184, 150, 231, 149, 140]);
    const result = detectAndDecodeHtml(utf8Bytes.buffer);
    expect(result).toBe('Hello, 世界');
  });

  it('should correctly decode UTF-16LE binary array with BOM', () => {
    // "Hello, 世界" 的 UTF-16LE 带有 BOM (FF FE) 字节流
    const utf16Bytes = new Uint8Array([
      0xff, 0xfe, // BOM
      0x48, 0x00, // H
      0x65, 0x00, // e
      0x6c, 0x00, // l
      0x6c, 0x00, // l
      0x6f, 0x00, // o
      0x2c, 0x00, // ,
      0x20, 0x00, //  
      0x16, 0x4e, // 世
      0x4c, 0x75  // 界
    ]);
    const result = detectAndDecodeHtml(utf16Bytes.buffer);
    expect(result).toBe('Hello, 世界');
  });
});
