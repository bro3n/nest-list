import type { H3Event } from "h3";

// Minimal D1 surface we rely on — avoids a dependency on @cloudflare/workers-types.
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface CfEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
}

export const useCfEnv = (event: H3Event): CfEnv => {
  const env = (event.context.cloudflare as { env?: CfEnv } | undefined)?.env;
  if (!env?.DB) {
    throw createError({ statusCode: 500, statusMessage: "Cloudflare D1 binding 'DB' unavailable" });
  }
  return env;
};

export const useDb = (event: H3Event): D1Database => useCfEnv(event).DB;

// Fallback keeps local dev working without a configured secret; production must set one.
export const sessionSecret = (event: H3Event): string =>
  useCfEnv(event).SESSION_SECRET || "dev-only-secret-change-in-production";
