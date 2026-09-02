import fs from "node:fs";
import path from "node:path";

export interface FileStorage {
  kind: "local" | "sharepoint";
  write(relativePath: string, content: Buffer): Promise<string>;
  read(relativePath: string): Promise<Buffer>;
  list(prefix: string): Promise<string[]>;
  exists(relativePath: string): Promise<boolean>;
  resolve(relativePath: string): string;
}

export class LocalFileStorage implements FileStorage {
  kind = "local" as const;
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  resolve(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const abs = path.resolve(this.root, normalized);
    if (!abs.startsWith(path.resolve(this.root))) {
      throw new Error("Invalid storage path");
    }
    return abs;
  }

  async write(relativePath: string, content: Buffer): Promise<string> {
    const abs = this.resolve(relativePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return relativePath.replace(/\\/g, "/");
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFileSync(this.resolve(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(this.resolve(relativePath));
  }

  async list(prefix: string): Promise<string[]> {
    const abs = this.resolve(prefix);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), r);
        else out.push(r);
      }
    };
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) walk(abs, prefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""));
    else out.push(prefix);
    return out;
  }
}

/**
 * Production hook: persist under a SharePoint document library via Microsoft Graph.
 * Configure GRAPH_SITE_ID + GRAPH_DRIVE_ID (or SITE_URL). Demo mode never calls Graph.
 */
export class SharePointFileStorage implements FileStorage {
  kind = "sharepoint" as const;
  constructor(
    private readonly fallback: LocalFileStorage,
    private readonly config: {
      siteId?: string;
      driveId?: string;
      libraryPath?: string;
      accessToken?: string;
    },
  ) {}

  resolve(relativePath: string): string {
    return this.fallback.resolve(relativePath);
  }

  async write(relativePath: string, content: Buffer): Promise<string> {
    if (!this.config.accessToken || !this.config.driveId) {
      return this.fallback.write(relativePath, content);
    }
    const itemPath = `${this.config.libraryPath ?? ""}/${relativePath}`.replace(/\/+/g, "/");
    const url = `https://graph.microsoft.com/v1.0/drives/${this.config.driveId}/root:${itemPath}:/content`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(content),
    });
    if (!res.ok) {
      throw new Error(`Graph upload failed ${res.status}: ${await res.text()}`);
    }
    await this.fallback.write(relativePath, content);
    return relativePath;
  }

  async read(relativePath: string): Promise<Buffer> {
    return this.fallback.read(relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return this.fallback.exists(relativePath);
  }

  async list(prefix: string): Promise<string[]> {
    return this.fallback.list(prefix);
  }
}

export function createStorage(): FileStorage {
  const root = process.env.MI20_STORAGE_ROOT ?? path.resolve(process.cwd(), "storage");
  const local = new LocalFileStorage(root);
  if (process.env.GRAPH_DRIVE_ID) {
    return new SharePointFileStorage(local, {
      siteId: process.env.GRAPH_SITE_ID,
      driveId: process.env.GRAPH_DRIVE_ID,
      libraryPath: process.env.GRAPH_LIBRARY_PATH ?? "",
    });
  }
  return local;
}
