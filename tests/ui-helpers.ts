import "global-jsdom/register";
import { cleanup } from "@testing-library/react";
import { afterEach } from "node:test";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
(globalThis as Record<string, unknown>).FormData = window.FormData;

window.HTMLElement.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  // Cancel any intervals left open by components (e.g. the MatchEditor polling loop).
  // We get the highest id from a fresh timer, then clear everything below it.
  const top = window.setInterval(() => {}, 999999);
  for (let i = 0; i <= top; i++) window.clearInterval(i);
});

export type Call = { url: string; method: string; body?: unknown };

/** Replaces fetch with a scripted fake and records every call. */
export function fakeFetch(handler: (call: Call) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const call: Call = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const out = await handler(call);
    return new Response(JSON.stringify(out.body ?? {}), { status: out.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}
