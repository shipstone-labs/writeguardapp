// Mock KV storage for local development
// In production, this will use Cloudflare KV

interface KVStorage {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

class MockKVStorage implements KVStorage {
  private storage: Map<string, string> = new Map();
  private filePath: string;
  private initialized: boolean = false;

  constructor() {
    // Use a local file to persist data between restarts
    this.filePath = './.dev-kv-storage.json';
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.loadFromFile();
      this.initialized = true;
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.storage = new Map(Object.entries(data));
        console.log('🗄️ [MockKV] Loaded from file:', this.storage.size, 'keys');
      }
    } catch {
      console.log('🗄️ [MockKV] No existing storage file, starting fresh');
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      const fs = await import('node:fs');
      const data = Object.fromEntries(this.storage);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      console.log('🗄️ [MockKV] Saved to file');
    } catch (error) {
      console.error('🗄️ [MockKV] Failed to save to file:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureInitialized();
    const value = this.storage.get(key) || null;
    console.log('🗄️ [MockKV] GET:', key, '→', value ? 'found' : 'not found');
    return value;
  }

  async put(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    this.storage.set(key, value);
    await this.saveToFile(); // Persist immediately
    console.log('🗄️ [MockKV] PUT:', key, '→', 'stored and persisted');
  }

  // Helper for debugging
  async list(): Promise<void> {
    await this.ensureInitialized();
    console.log('🗄️ [MockKV] All keys:', Array.from(this.storage.keys()));
  }
}

class CloudflareKVStorage implements KVStorage {
  async get(key: string): Promise<string | null> {
    // @ts-expect-error - Cloudflare runtime
    const value = await KV.get(key);
    console.log('☁️ [CloudflareKV] GET:', key, '→', value ? 'found' : 'not found');
    return value;
  }

  async put(key: string, value: string): Promise<void> {
    // @ts-expect-error - Cloudflare runtime
    await KV.put(key, value);
    console.log('☁️ [CloudflareKV] PUT:', key, '→', 'stored');
  }
}

// Factory function to get the right storage based on environment
export function getKVStorage(): KVStorage {
  const isCloudflare = typeof globalThis !== 'undefined' && 'KV' in globalThis;
  
  if (isCloudflare) {
    console.log('☁️ Using Cloudflare KV storage');
    return new CloudflareKVStorage();
  } else {
    console.log('🏠 Using Mock KV storage for local development');
    return new MockKVStorage();
  }
}

export type { KVStorage };