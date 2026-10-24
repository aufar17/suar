"use client";

import { useCallback, useEffect, useState } from "react";

// Responses only change about once a day, so they are kept for the lifetime of the tab, up to
// a limit: map views request many areas (risk grid), and the oldest responses are dropped.
const MAX_CACHED = 60;
const responseCache = new Map<string, unknown>();

function remember(url: string, data: unknown) {
  responseCache.delete(url);
  responseCache.set(url, data);
  while (responseCache.size > MAX_CACHED) responseCache.delete(responseCache.keys().next().value!);
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; detail?: { pesan: string }[] };
    const detail = body.detail?.map((d) => d.pesan).join("; ");
    return [body.error, detail].filter(Boolean).join(": ") || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

const pending = new Map<string, Promise<unknown>>();

/** Loads a URL into the response cache ahead of time (e.g. the next prediction days). */
export function prefetchJson(url: string): Promise<unknown> {
  if (responseCache.has(url)) return Promise.resolve(responseCache.get(url));
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(await readError(response));
      const data: unknown = await response.json();
      remember(url, data);
      return data;
    })
    .finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}

export interface JsonState<T> {
  /** Latest data. While a new URL loads, this still holds the previous result. */
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  retry: () => void;
}

/** Fetches JSON from a route handler. Pass `null` to skip. */
export function useJson<T>(url: string | null): JsonState<T> {
  const [state, setState] = useState<{ url: string | null; data?: T; error?: string }>({ url: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url || responseCache.has(url)) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as T;
      })
      .then((data) => {
        remember(url, data);
        setState({ url, data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Gagal memuat data";
        setState((prev) => ({ url, data: prev.data, error: message }));
      });
    return () => controller.abort();
  }, [url, attempt]);

  const retry = useCallback(() => {
    setState((prev) => ({ url: null, data: prev.data }));
    setAttempt((n) => n + 1);
  }, []);

  if (url && responseCache.has(url)) {
    return { data: responseCache.get(url) as T, error: undefined, loading: false, retry };
  }
  if (url && state.url === url) {
    return { data: state.data, error: state.error, loading: false, retry };
  }
  return { data: state.data, error: undefined, loading: url !== null, retry };
}
