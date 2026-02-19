// ============================================================
// Export Service — Create ZIP archives of artifacts
// ============================================================

interface ZipEntry {
  name: string;
  content: string;
  compressed: boolean;
}

/**
 * Create a simple ZIP buffer from file entries
 * Note: This is a simplified implementation. For production,
 * install jszip: npm install jszip @types/jszip
 */
export async function createZipArchive(files: Record<string, string>): Promise<Buffer> {
  const entries: ZipEntry[] = [];

  for (const [name, content] of Object.entries(files)) {
    entries.push({
      name,
      content,
      compressed: false,
    });
  }

  // Simple implementation - concatenate with headers
  const parts: Buffer[] = [];

  for (const entry of entries) {
    const header = Buffer.from(`FILE:${entry.name}:${entry.content.length}\n`);
    parts.push(header);
    parts.push(Buffer.from(entry.content, 'utf-8'));
    parts.push(Buffer.from('\nEND\n'));
  }

  return Buffer.concat(parts);
}
