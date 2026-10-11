// Node.js test environment polyfills
const storageMap = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string): string | null => storageMap.get(key) || null,
  setItem: (key: string, val: string): void => {
    storageMap.set(key, String(val));
  },
  removeItem: (key: string): void => {
    storageMap.delete(key);
  },
  clear: (): void => {
    storageMap.clear();
  },
  get length(): number {
    return storageMap.size;
  },
  key: (i: number): string | null => Array.from(storageMap.keys())[i] || null,
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = globalThis;
