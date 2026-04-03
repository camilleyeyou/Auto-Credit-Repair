/**
 * FastAPI backend client.
 * Base URL is set via NEXT_PUBLIC_FASTAPI_URL environment variable.
 * Defaults to localhost:8000 for local development.
 *
 * Per D-12: FastAPI handles PDF parsing and AI operations only.
 * Auth and data storage go through Convex directly, not through FastAPI.
 */
const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000";

/**
 * Fetch wrapper for FastAPI backend calls.
 * Throws an Error with status code on non-2xx responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`FastAPI error ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Check if the FastAPI backend is reachable.
 * Used for deployment verification (per D-14).
 */
export async function checkHealth(): Promise<{ status: string; service: string }> {
  return apiFetch<{ status: string; service: string }>("/api/health");
}
