export function detectAndDecodeHtml(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let encoding = 'utf-8';

  // 1. 检查 BOM 头 (UTF-16LE: FF FE)
  if (uint8.length >= 2 && uint8[0] === 0xff && uint8[1] === 0xfe) {
    encoding = 'utf-16le';
  } else {
    // 2. 兜底检测前 100 字节的 0x00 字节占比（UTF-16LE 每一个 ASCII 字符后面都有一个 0x00）
    let zeroBytes = 0;
    const limit = Math.min(uint8.length, 100);
    for (let i = 0; i < limit; i++) {
      if (uint8[i] === 0x00) {
        zeroBytes++;
      }
    }
    if (zeroBytes > 10) {
      encoding = 'utf-16le';
    }
  }

  const decoder = new TextDecoder(encoding);
  return decoder.decode(uint8);
}
