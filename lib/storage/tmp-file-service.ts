import { promises as fs } from "fs";
import path from "path";
import os from "os";

const TMP_DIR = path.join(os.tmpdir(), "uploads");

// Ensure upload dir exists
async function ensureUploadDir() {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

export async function saveFileToTmp(file: File): Promise<string> {
  await ensureUploadDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(TMP_DIR, file.name);

  await fs.writeFile(filePath, buffer);

  // Save metadata alongside file (optional)
  const metadata = {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  };
  await fs.writeFile(`${filePath}.json`, JSON.stringify(metadata));

  return file.name;
}

export async function getFileFromTmp(filename: string): Promise<{ buffer: Buffer; metadata: any } | null> {
  const filePath = path.join(TMP_DIR, filename);
  const metadataPath = `${filePath}.json`;

  try {
    const buffer = await fs.readFile(filePath);
    const metadataRaw = await fs.readFile(metadataPath, "utf8");
    const metadata = JSON.parse(metadataRaw);

    return { buffer, metadata };
  } catch {
    return null;
  }
}

export async function deleteFileFromTmp(filename: string): Promise<boolean> {
  const filePath = path.join(TMP_DIR, filename);
  const metadataPath = `${filePath}.json`;

  try {
    await fs.unlink(filePath);
    await fs.unlink(metadataPath);
    return true;
  } catch {
    return false;
  }
}

export async function listFilesInTmp(): Promise<{ filename: string; metadata: any }[]> {
  try {
    await ensureUploadDir();
    const files = await fs.readdir(TMP_DIR);
    const entries = files.filter((f) => !f.endsWith(".json"));
    const results = await Promise.all(
      entries.map(async (filename) => {
        const metadataRaw = await fs.readFile(path.join(TMP_DIR, `${filename}.json`), "utf8");
        const metadata = JSON.parse(metadataRaw);
        return { filename, metadata };
      }),
    );
    return results;
  } catch {
    return [];
  }
}
