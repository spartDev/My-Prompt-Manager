export type Output = { log: (line: string) => void; summary: (markdown: string) => void };
export type Env = Record<string, string | undefined>;
export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: unknown }) => Promise<Response>;
export type Plan = { action: 'upload' } | { action: 'none'; reason: string } | { action: 'refuse'; reason: string };

export const API_ROOT: string;
export const POLL: { attempts: number; intervalMs: number };
export function parseVersion(version: unknown): number[] | null;
export function compareVersions(a: string, b: string): -1 | 0 | 1;
export function readZipEntry(zip: Buffer, name: string): Buffer | null;
export function zipVersion(zip: Buffer): string;
export function planSubmission(status: unknown, version: string): Plan;
export function configFrom(env: Env): { token: string; publisherId: string; itemId: string };
export class StoreError extends Error {
  call: string;
  status?: number;
  googleMessage?: string;
  body?: string;
}
export function storeStatus(options: { env: Env; fetch: Fetch; out: Output; zip?: Buffer }): Promise<{ ok: boolean; plan?: Plan }>;
export function submitRelease(options: {
  env: Env;
  fetch: Fetch;
  out: Output;
  zip: Buffer;
  version: string;
  sleep?: (ms: number) => Promise<void>;
  poll?: { attempts: number; intervalMs: number };
}): Promise<{ ok: boolean; outcome: 'invalid' | 'unchanged' | 'refused' | 'failed' | 'submitted' }>;
