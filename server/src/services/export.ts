// ============================================================
// Export Service — Create real ZIP archives of artifacts
//
// Uses Node.js built-in zlib for DEFLATE compression.
// Implements the ZIP format spec (PKZIP APPNOTE 6.3.3) with
// local file headers, central directory, and EOCD record.
// ============================================================

import { deflateRawSync } from 'zlib';

/**
 * Create a valid ZIP buffer from file entries using DEFLATE compression.
 */
export async function createZipArchive(files: Record<string, string>): Promise<Buffer> {
  const localHeaders: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, 'utf-8');
    const uncompressedData = Buffer.from(content, 'utf-8');
    const compressedData = deflateRawSync(uncompressedData);
    const crc = crc32(uncompressedData);

    // Local file header (30 bytes + name + compressed data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);  // Local file header signature
    local.writeUInt16LE(20, 4);           // Version needed to extract (2.0)
    local.writeUInt16LE(0, 6);            // General purpose bit flag
    local.writeUInt16LE(8, 8);            // Compression method: DEFLATE
    local.writeUInt16LE(0, 10);           // Last mod file time
    local.writeUInt16LE(0, 12);           // Last mod file date
    local.writeUInt32LE(crc, 14);         // CRC-32
    local.writeUInt32LE(compressedData.length, 18);   // Compressed size
    local.writeUInt32LE(uncompressedData.length, 22);  // Uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);         // File name length
    local.writeUInt16LE(0, 28);           // Extra field length

    localHeaders.push(local, nameBytes, compressedData);

    // Central directory file header (46 bytes + name)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);  // Central directory header signature
    central.writeUInt16LE(20, 4);           // Version made by
    central.writeUInt16LE(20, 6);           // Version needed to extract
    central.writeUInt16LE(0, 8);            // General purpose bit flag
    central.writeUInt16LE(8, 10);           // Compression method: DEFLATE
    central.writeUInt16LE(0, 12);           // Last mod file time
    central.writeUInt16LE(0, 14);           // Last mod file date
    central.writeUInt32LE(crc, 16);         // CRC-32
    central.writeUInt32LE(compressedData.length, 20);   // Compressed size
    central.writeUInt32LE(uncompressedData.length, 24);  // Uncompressed size
    central.writeUInt16LE(nameBytes.length, 28);         // File name length
    central.writeUInt16LE(0, 30);           // Extra field length
    central.writeUInt16LE(0, 32);           // File comment length
    central.writeUInt16LE(0, 34);           // Disk number start
    central.writeUInt16LE(0, 36);           // Internal file attributes
    central.writeUInt32LE(0, 38);           // External file attributes
    central.writeUInt32LE(offset, 42);      // Relative offset of local header

    centralEntries.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressedData.length;
  }

  const centralDirData = Buffer.concat(centralEntries);
  const centralDirOffset = offset;
  const entryCount = Object.keys(files).length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);              // EOCD signature
  eocd.writeUInt16LE(0, 4);                        // Number of this disk
  eocd.writeUInt16LE(0, 6);                        // Disk where CD starts
  eocd.writeUInt16LE(entryCount, 8);                // Number of CD records on this disk
  eocd.writeUInt16LE(entryCount, 10);               // Total number of CD records
  eocd.writeUInt32LE(centralDirData.length, 12);    // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);         // Offset of start of CD
  eocd.writeUInt16LE(0, 20);                        // Comment length

  return Buffer.concat([...localHeaders, centralDirData, eocd]);
}

// CRC-32 implementation (standard polynomial 0xEDB88320)
function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
