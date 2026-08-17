function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime() {
  const date = new Date();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function concatBytes(chunks, size) {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function createStoredZip(entries) {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime();
  const localChunks = [];
  const centralChunks = [];
  let localSize = 0;
  let centralSize = 0;
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, day);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, entry.data.length);
    writeUint32(localView, 22, entry.data.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localChunks.push(local);
    localSize += local.length;

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, day);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, entry.data.length);
    writeUint32(centralView, 24, entry.data.length);
    writeUint16(centralView, 28, name.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(name, 46);
    centralChunks.push(central);
    centralSize += central.length;
    offset += local.length;
  }

  const footer = new Uint8Array(22);
  const footerView = new DataView(footer.buffer);
  writeUint32(footerView, 0, 0x06054b50);
  writeUint16(footerView, 4, 0);
  writeUint16(footerView, 6, 0);
  writeUint16(footerView, 8, entries.length);
  writeUint16(footerView, 10, entries.length);
  writeUint32(footerView, 12, centralSize);
  writeUint32(footerView, 16, localSize);
  writeUint16(footerView, 20, 0);

  return concatBytes([...localChunks, ...centralChunks, footer], localSize + centralSize + footer.length);
}
