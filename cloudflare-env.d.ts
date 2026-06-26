// Minimal, hand-written Cloudflare binding types for getCloudflareContext().env.
// We deliberately do NOT use `wrangler types` / @cloudflare/workers-types here:
// those globally override DOM types (e.g. Response.json() -> unknown), which
// breaks the browser-typed client code throughout this Next.js app.

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<never>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

// Merged into OpenNext's global CloudflareEnv used by getCloudflareContext().
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
}
