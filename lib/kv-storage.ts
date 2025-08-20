// Simple KV storage interface for Cloudflare KV
// @opennextjs/cloudflare provides KV emulation in development

interface KVStorage {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

class CloudflareKVStorage implements KVStorage {
  async get(key: string): Promise<string | null> {
    // @ts-expect-error - Cloudflare runtime binding
    const value = await KV.get(key);
    console.log('☁️ [KV] GET:', key, '→', value ? 'found' : 'not found');
    return value;
  }

  async put(key: string, value: string): Promise<void> {
    // @ts-expect-error - Cloudflare runtime binding
    await KV.put(key, value);
    console.log('☁️ [KV] PUT:', key, '→', 'stored');
  }
}

// Simple factory - @opennextjs/cloudflare handles development emulation
export function getKVStorage(): KVStorage {
  return new CloudflareKVStorage();
}

export type { KVStorage };