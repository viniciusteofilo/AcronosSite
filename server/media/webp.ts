/**
 * Checks that bytes really are a WebP image (by content, not by file name) and reads its size.
 * Supports the three WebP layouts: VP8 (lossy), VP8L (lossless) and VP8X (extended).
 */
export function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const ascii = (o: number, n: number) => String.fromCharCode(...bytes.subarray(o, o + n));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  const chunk = ascii(12, 4);
  const u16 = (o: number) => bytes[o] | (bytes[o + 1] << 8);
  const u24 = (o: number) => bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16);
  if (chunk === "VP8X") {
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const b = bytes.subarray(21, 25);
    const width = 1 + (((b[1] & 0x3f) << 8) | b[0]);
    const height = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}
