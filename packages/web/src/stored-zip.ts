export function storedZip(files: Iterable<[string, Uint8Array]>): Uint8Array {
  const entries = [...files];
  if (entries.length > 0xffff) throw new Error("The project archive has too many files.");
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = new TextEncoder().encode(name);
    if (nameBytes.byteLength > 0xffff) throw new Error(`Project path is too long: ${name}`);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.byteLength);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, 0x0800);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, data.byteLength);
    writeUint32(local, 22, data.byteLength);
    writeUint16(local, 26, nameBytes.byteLength);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const directory = new Uint8Array(46 + nameBytes.byteLength);
    writeUint32(directory, 0, 0x02014b50);
    writeUint16(directory, 4, 20);
    writeUint16(directory, 6, 20);
    writeUint16(directory, 8, 0x0800);
    writeUint32(directory, 16, crc);
    writeUint32(directory, 20, data.byteLength);
    writeUint32(directory, 24, data.byteLength);
    writeUint16(directory, 28, nameBytes.byteLength);
    writeUint32(directory, 42, offset);
    directory.set(nameBytes, 46);
    central.push(directory);
    offset += local.byteLength + data.byteLength;
  }
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, offset);
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0) + centralSize + end.byteLength;
  const zip = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...parts, ...central, end]) {
    zip.set(part, cursor);
    cursor += part.byteLength;
  }
  return zip;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}
