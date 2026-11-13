import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Run cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

// Provide Storage polyfill for Node.js 26+ where native localStorage requires --localstorage-file
class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }
}

if (typeof window !== 'undefined') {
  if (!window.localStorage || typeof window.localStorage.clear !== 'function') {
    const mock = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', { value: mock, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true });
  }
  if (!window.sessionStorage || typeof window.sessionStorage.clear !== 'function') {
    const mock = new MemoryStorage();
    Object.defineProperty(window, 'sessionStorage', { value: mock, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: mock, writable: true, configurable: true });
  }
}
