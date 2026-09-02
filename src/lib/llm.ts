/* ============================================================
   SUTR LLM LAYER
   Retrieve-context → LLM reasoning → structured output.
   The API key lives in this browser only (localStorage) and is
   sent solely to the provider you choose — never logged, never
   rendered in the UI. Without a key, agents fall back to the
   on-device grounded-reasoning engine (labelled as such).
   ============================================================ */

export type Provider = "anthropic" | "openai" | "ondevice";

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

const LS_KEY = "sutr.llm.v1";

const DEFAULT_MODELS: Record<Exclude<Provider, "ondevice">, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o-mini",
};

export const MODELS: Record<Exclude<Provider, "ondevice">, { id: string; label: string; cost: string }[]> = {
  anthropic: [
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku — fastest, cheapest", cost: "$0.80 in / $4 out per 1M tokens" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 — best judgment", cost: "$3 in / $15 out per 1M tokens" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — cheap workhorse", cost: "$0.15 in / $0.60 out per 1M tokens" },
    { id: "gpt-4o", label: "GPT-4o — deeper reasoning", cost: "$2.50 in / $10 out per 1M tokens" },
  ],
};

export function getLLM(): LLMConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LLMConfig;
      if (parsed && parsed.provider) return { ...parsed, apiKey: parsed.apiKey ?? "" };
    }
  } catch {
    /* fall through to default */
  }
  return { provider: "ondevice", apiKey: "", model: DEFAULT_MODELS.anthropic };
}

export function saveLLM(cfg: LLMConfig) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {
    /* non-fatal */
  }
}

export function hasLiveEngine(): boolean {
  const c = getLLM();
  return c.provider !== "ondevice" && c.apiKey.trim().length > 10;
}

export function engineLabel(): string {
  const c = getLLM();
  if (c.provider === "anthropic" && hasLiveEngine()) return "Claude live";
  if (c.provider === "openai" && hasLiveEngine()) return "OpenAI live";
  return "On-device reasoning";
}

export interface LLMResult {
  engine: "claude" | "openai";
  raw: string;
}

export async function reasonLLM(system: string, user: string, maxTokens = 1400): Promise<LLMResult> {
  const cfg = getLLM();
  if (!hasLiveEngine()) throw new Error("no-live-engine");

  if (cfg.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        temperature: 0.4,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 180)}`);
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = (data.content ?? []).map((b) => b.text ?? "").join("");
    return { engine: "claude", raw: text };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${cfg.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: cfg.model || DEFAULT_MODELS.openai,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 180)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { engine: "openai", raw: text };
}

/** Lenient JSON extraction — tolerates code fences and preamble. */
export function parseJSON<T>(raw: string): T {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text) as T;
}

export async function pingLLM(): Promise<{ ok: boolean; ms: number; detail: string }> {
  const start = Date.now();
  try {
    const res = await reasonLLM(
      "You are a connectivity probe. Reply with exactly the word: ready",
      "ping",
      20
    );
    return { ok: true, ms: Date.now() - start, detail: `${res.engine} responded "${res.raw.trim().slice(0, 40)}"` };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, detail: e instanceof Error ? e.message : "connection failed" };
  }
}
