import { useState } from "react";
import { useApp, timeAgo, resetDemo, setOwnerName } from "../lib/store";
import type { AgentName } from "../lib/store";
import { getLLM, saveLLM, pingLLM, MODELS, engineLabel } from "../lib/llm";
import type { Provider } from "../lib/llm";
import { AGENT_TONES, Btn, Chip, Icon, Modal, Trace, toast } from "./ui";

/* ================= ACTIVITY LOG ================= */

export function ActivityView() {
  const s = useApp();
  const [agent, setAgent] = useState<"all" | AgentName>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const entries = s.activity.filter((a) => agent === "all" || a.agent === agent);

  return (
    <div className="space-y-5">
      <header className="rv">
        <div className="tick mb-1">orchestrator · append-only</div>
        <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Every agent action, on the record</h1>
        <p className="mt-1 text-xs text-ink-faint">This is how you audit reasoning instead of trusting it. {s.activity.length} entries logged.</p>
      </header>
      <div className="rv flex flex-wrap gap-1.5" style={{ animationDelay: "0.06s" }}>
        {(["all", "sales", "marketing", "ops", "vault", "system"] as const).map((a) => (
          <button key={a} onClick={() => setAgent(a)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${agent === a ? "border-gold-400 bg-gold-500/20 text-gold-200" : "border-plum-600 text-ink-faint hover:border-gold-500/50 hover:text-gold-300"}`}>
            {a} {a !== "all" && <span className="opacity-60">({s.activity.filter((x) => x.agent === a).length})</span>}
          </button>
        ))}
      </div>
      <section className="rv panel divide-y divide-plum-800/80" style={{ animationDelay: "0.1s" }}>
        {entries.map((a, i) => {
          const tone = AGENT_TONES[a.agent];
          const open = openId === a.id;
          return (
            <div key={a.id} className="rv-slide px-4 py-3" style={{ animationDelay: `${Math.min(i * 0.03, 0.4)}s` }}>
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${tone.text}`}>{a.agent} · {a.action}</span>
                    <span className="font-mono text-[10px] text-ink-faint">{timeAgo(a.ts)} · {new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <Chip tone={a.engine === "ondevice" ? "teal" : "gold"} className="ml-auto">{a.engine === "ondevice" ? "on-device" : a.engine}</Chip>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.summary}</p>
                  {a.trace?.length > 0 && (
                    <button onClick={() => setOpenId(open ? null : a.id)} className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-gold-500 transition-colors hover:text-gold-300">
                      {open ? "− collapse reasoning" : "+ reasoning trail"}
                    </button>
                  )}
                  {open && <div className="mt-2"><Trace steps={a.trace} engine={a.engine} />{a.refs.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{a.refs.map((r) => <Chip key={r} tone="dim">{r}</Chip>)}</div>}</div>}
                </div>
              </div>
            </div>
          );
        })}
        {entries.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">No entries for this agent yet.</p>}
      </section>
    </div>
  );
}

/* ================= SETTINGS ================= */

export function SettingsView() {
  const s = useApp();
  const [llm, setLlm] = useState(getLLM);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; ms: number; detail: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(s.ownerName);

  const set = (patch: Partial<typeof llm>) => setLlm((cur) => ({ ...cur, ...patch }));

  const persist = () => {
    saveLLM(llm);
    toast(`Engine saved — ${engineLabel()}. Keys stay in this browser.`, "teal");
    setTestResult(null);
  };

  const test = async () => {
    saveLLM(llm);
    setTesting(true);
    const r = await pingLLM();
    setTestResult(r);
    setTesting(false);
    toast(r.ok ? `Live connection confirmed in ${r.ms}ms.` : "Connection failed — details below; on-device engine remains active.", r.ok ? "teal" : "rani");
  };

  const input = "w-full rounded-lg border border-plum-600/70 bg-plum-950/70 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-gold-500/60";

  return (
    <div className="space-y-5">
      <header className="rv">
        <div className="tick mb-1">system · reasoning engine & guardrails</div>
        <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">How the agents think — and what they may never do</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* engine */}
        <section className="rv panel p-5" style={{ animationDelay: "0.06s" }}>
          <h2 className="mb-1 font-display text-xl text-gold-200">Reasoning engine</h2>
          <p className="mb-4 text-xs text-ink-faint">Current: <span className="text-gold-300">{engineLabel()}</span>. Without a key, agents run the on-device grounded engine — still data-bound, clearly labelled. With a key, every judgment call goes to the live LLM with the full store dossier attached.</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {([
              ["ondevice", "On-device", "grounded heuristics, ₹0"],
              ["anthropic", "Claude", "Sutr's stack — recommended"],
              ["openai", "OpenAI", "gpt-4o family"],
            ] as [Provider, string, string][]).map(([p, label, sub]) => (
              <button key={p} onClick={() => set({ provider: p, model: p === "ondevice" ? "" : MODELS[p as "anthropic" | "openai"][p === "anthropic" ? 0 : 0].id })}
                className={`rounded-lg border p-3 text-left transition-all ${llm.provider === p ? "border-gold-400 bg-gold-500/15" : "border-plum-600 hover:border-gold-500/40"}`}>
                <div className={`text-sm font-bold ${llm.provider === p ? "text-gold-200" : "text-ink"}`}>{label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-ink-faint">{sub}</div>
              </button>
            ))}
          </div>
          {llm.provider !== "ondevice" && (
            <div className="space-y-3">
              <label className="block">
                <span className="tick flex items-center gap-1"><Icon name="key" size={10} /> {llm.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key</span>
                <div className="mt-1 flex gap-2">
                  <input className={input} type={showKey ? "text" : "password"} value={llm.apiKey}
                    onChange={(e) => set({ apiKey: e.target.value })}
                    placeholder={llm.provider === "anthropic" ? "sk-ant-…" : "sk-…"} />
                  <Btn variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}><Icon name={showKey ? "x" : "eye"} size={13} /></Btn>
                </div>
              </label>
              <label className="block">
                <span className="tick">model</span>
                <select className={input + " mt-1"} value={llm.model} onChange={(e) => set({ model: e.target.value })}>
                  {MODELS[llm.provider as "anthropic" | "openai"].map((m) => (
                    <option key={m.id} value={m.id}>{m.label} — {m.cost}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={persist}><Icon name="check" size={13} /> Save engine</Btn>
                <Btn variant="outline" onClick={test} disabled={testing || !llm.apiKey}>{testing ? "Testing…" : <><Icon name="bolt" size={13} /> Test connection</>}</Btn>
              </div>
              {testResult && (
                <div className={`rounded-lg border p-3 text-xs ${testResult.ok ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-rani-500/40 bg-rani-500/10 text-rani-300"}`}>
                  {testResult.ok ? `✓ ${testResult.detail} (${testResult.ms}ms)` : `✗ ${testResult.detail}`}
                  {!testResult.ok && <div className="mt-1 text-[10px] text-ink-faint">Common causes: wrong key, exhausted credits, or network/CORS. On-device reasoning keeps running regardless.</div>}
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-ink-faint">
                <Icon name="lock" size={10} className="mr-1 inline text-gold-400" />
                Your key is stored in this browser's local storage and sent only to {llm.provider === "anthropic" ? "Anthropic's" : "OpenAI's"} API — never rendered in the UI, never logged. For a team deployment, move this behind a small proxy; a static-site demo should not ship keys.
              </p>
            </div>
          )}
          {llm.provider === "ondevice" && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3.5 text-xs leading-relaxed text-ink-dim">
              On-device mode is live. Agents gather the same store context and cite the same record ids — the reasoning is data-bound, just not LLM-generated. Add an Anthropic key to upgrade every judgment call to live Claude.
            </div>
          )}
        </section>

        {/* cost picture */}
        <section className="rv panel p-5" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 font-display text-xl text-gold-200">The cost picture, straight</h2>
          <div className="space-y-2.5 text-xs text-ink-dim">
            <div className="rounded-lg border border-gold-500/25 bg-gold-500/5 p-3">
              <div className="font-bold text-gold-300">Trial credits</div>
              <p className="mt-1 leading-relaxed">New Anthropic API workspaces typically receive <span className="text-ink">~$5 in free credits</span> (no card charged until they run out). OpenAI's free tier varies by account vintage — check billing.openai.com before relying on it.</p>
            </div>
            <table className="w-full font-mono text-[11px]">
              <thead><tr className="tick"><th className="pb-1.5 text-left">model</th><th className="pb-1.5 text-left">in / 1M</th><th className="pb-1.5 text-left">out / 1M</th></tr></thead>
              <tbody className="text-ink-dim">
                <tr><td className="py-1">claude 3.5 haiku</td><td>$0.80</td><td>$4.00</td></tr>
                <tr><td className="py-1">claude sonnet 4.5</td><td>$3.00</td><td>$15.00</td></tr>
                <tr><td className="py-1">gpt-4o mini</td><td>$0.15</td><td>$0.60</td></tr>
                <tr><td className="py-1">gpt-4o</td><td>$2.50</td><td>$10.00</td></tr>
              </tbody>
            </table>
            <p className="leading-relaxed">A full day of Sutr agent work (digest + ~20 agent calls with store dossiers) is roughly 60–90K tokens — <span className="text-ink">a few cents on Haiku</span>, under a rupee on Sonnet. Your $5 trial covers thousands of runs. Prices are public list rates; verify before committing.</p>
          </div>
        </section>

        {/* guardrails */}
        <section className="rv panel p-5" style={{ animationDelay: "0.14s" }}>
          <h2 className="mb-3 font-display text-xl text-gold-200">Non-negotiable guardrails</h2>
          <ol className="space-y-2.5">
            {[
              ["No autonomous sending", "Sales drafts in Gmail; compose opens pre-filled, you press send. Zero emails leave without your click."],
              ["No autonomous spending", "Marketing proposes budgets in briefs; nothing is committed or charged."],
              ["No fabricated grounding", "If the data isn't in the shared store, agents say so — they never invent stats, planner details or competitor facts."],
              ["Every output explainable", "Each output carries a reasoning trail you can open with 'why?' — the actual data weighed, not a restated conclusion."],
              ["Vault is owner-only", "Access-controlled to you; sharing requires an explicit grant (real enforcement needs auth in production)."],
            ].map(([t, d], i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-plum-700/60 bg-plum-950/40 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/15 font-mono text-[10px] text-gold-300">{i + 1}</span>
                <div><div className="text-xs font-bold text-ink">{t}</div><p className="mt-0.5 text-[11px] leading-relaxed text-ink-dim">{d}</p></div>
              </li>
            ))}
          </ol>
        </section>

        {/* owner + data + open questions */}
        <div className="space-y-5">
          <section className="rv panel p-5" style={{ animationDelay: "0.18s" }}>
            <h2 className="mb-3 font-display text-xl text-gold-200">Owner identity</h2>
            <div className="flex gap-2">
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" />
              <Btn onClick={() => { setOwnerName(name.trim()); toast(`Digests and drafts now sign off as ${name.trim()}.`); }}><Icon name="check" size={13} /> Save</Btn>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">Used in draft sign-offs and the morning greeting.</p>
          </section>

          <section className="rv panel p-5" style={{ animationDelay: "0.22s" }}>
            <h2 className="mb-3 font-display text-xl text-gold-200">Spec — open questions I flagged</h2>
            <ul className="space-y-2 text-[11px] leading-relaxed text-ink-dim">
              {[
                "Gmail OAuth needs a server-side token store; this build ships the drafts-only handoff (compose link) that already enforces the no-auto-send rule. OAuth slots in without changing the flow.",
                "Per-event pricing assumed Starter ₹9K / Studio ₹14K / Growth ₹24K / Scale ₹40K+ — adjust if your ladder differs.",
                "Ops watches planners onboarded onto the Sutr platform (your customers); Sales watches prospects. Vivah Crafters is deliberately both, to prove the shared-store hold rule.",
                "Vault 'owner-only' is a UI flag here — real enforcement requires authentication in production.",
                "The 06:00 trigger fires on first load after 6 AM; in production it becomes a scheduled job that pushes the digest to you.",
              ].map((q, i) => (
                <li key={i} className="flex gap-2"><span className="text-gold-500">?</span>{q}</li>
              ))}
            </ul>
          </section>

          <section className="rv panel border-rani-500/25 p-5" style={{ animationDelay: "0.26s" }}>
            <h2 className="mb-2 font-display text-xl text-rani-300">Demo data</h2>
            <p className="mb-3 text-[11px] text-ink-faint">Reset restores the seeded Sutr business: 10 leads, 5 customer accounts, 5 campaigns, 14 vault documents. Your engine key is kept.</p>
            <Btn variant="danger" onClick={() => setConfirmReset(true)}><Icon name="refresh" size={13} /> Reset demo data</Btn>
          </section>
        </div>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset all demo data?">
        <p className="text-sm text-ink-dim">Every lead change, draft, idea, risk resolution and ingested document returns to the seeded state. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Keep my data</Btn>
          <Btn variant="rani" onClick={() => { resetDemo(); setConfirmReset(false); toast("Demo data reset — agents re-seeded.", "rani"); }}>Reset everything</Btn>
        </div>
      </Modal>
    </div>
  );
}
