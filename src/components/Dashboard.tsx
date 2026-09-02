import { useMemo, useState } from "react";
import {
  useApp, timeAgo, fmtINR, TIERS,
} from "../lib/store";
import type { Draft } from "../lib/store";
import { writeBrief, expiryWatch } from "../lib/agents";
import { AGENT_TONES, Btn, Chip, Icon, Modal, SevBadge, ThreadArt, Trace, toast } from "./ui";

function gmailUrl(email: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const fmtLakh = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : fmtINR(n));

export default function Dashboard({ go, digestBusy }: { go: (v: string) => void; digestBusy: boolean }) {
  const s = useApp();
  const [traceFor, setTraceFor] = useState<{ title: string; steps: string[]; engine?: string } | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const readyDrafts = s.drafts.filter((d) => d.status === "ready" || d.status === "opened").slice(0, 3);
  const ideas = useMemo(() => s.ideas.filter((i) => i.status !== "dismissed").slice(0, 3), [s.ideas]);
  const openRisks = s.risks.filter((r) => r.status !== "resolved").sort((a, b) => b.severity - a.severity);
  const escalated = openRisks.filter((r) => r.status === "escalated");
  const expiring = expiryWatch();

  const pipelineValue = s.leads
    .filter((l) => ["new", "qualified", "drafted", "engaged"].includes(l.status))
    .reduce((sum, l) => {
      const t = TIERS.find((x) => x.name === l.tierFit);
      return sum + (t?.price ?? 9000) * l.eventsPerYear * (l.fitScore / 100);
    }, 0);

  const stages: [string, number][] = [
    ["new", 0], ["qualified", 0], ["drafted", 0], ["engaged", 0], ["nurture", 0],
  ].map(([name]) => [name, s.leads.filter((l) => l.status === name).length] as [string, number]);

  const onBrief = async (ideaId: string) => {
    setBriefing(ideaId);
    try {
      const idea = await writeBrief(ideaId);
      toast(`Brief written for “${idea.title.slice(0, 42)}…” — budget proposed only.`);
      go("marketing");
    } finally {
      setBriefing(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* header — the threads draw in */}
      <header className="rv relative overflow-hidden rounded-xl border border-gold-500/15 bg-gradient-to-br from-plum-850 to-plum-900 px-6 pb-2 pt-6">
        <div className="drift-glow pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="tick mb-1.5">{dateLine} · agent command</div>
            <h1 className="font-display text-4xl font-semibold leading-none text-ink md:text-5xl">
              {greet}, {s.ownerName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-dim">
              {digestBusy
                ? "The agents are compiling your morning brief — marketing ideas, overnight sales activity, ops alerts."
                : s.digest
                  ? <>Brief compiled at {new Date(s.digest.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {ideas.length} ideas · {s.drafts.filter((d) => d.status === "ready").length} drafts awaiting your send · {openRisks.length} open risks.</>
                  : "The 06:00 trigger compiles your brief each morning — ideas, send queue and ops alerts in one bundle."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="gold"><Icon name="shield" size={11} /> no auto-send</Chip>
            <Chip tone="teal"><Icon name="shield" size={11} /> no auto-spend</Chip>
          </div>
        </div>
        <ThreadArt className="relative mt-4 h-16 w-full" />
      </header>

      {/* escalation banner */}
      {escalated.map((r) => (
        <button key={r.id} onClick={() => go("ops")}
          className="rv flex w-full items-center gap-3 rounded-xl border border-rani-500/50 bg-rani-500/10 px-4 py-3 text-left transition-colors hover:bg-rani-500/20">
          <span className="pulse-dot flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rani-500/25 text-rani-300"><Icon name="alert" size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-rani-300">Escalated immediately — {r.title}</div>
            <div className="truncate text-xs text-ink-dim">{r.entity} · severity 3 · Sales pitch auto-held on linked lead · tap for the data trail</div>
          </div>
          <SevBadge level={3} />
        </button>
      ))}

      {/* morning digest band */}
      <section className="rv panel grid gap-0 lg:grid-cols-12" style={{ animationDelay: "0.08s" }}>
        <div className="border-b border-plum-700/50 p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="tick flex items-center gap-1.5 text-rani-300"><Icon name="megaphone" size={12} /> 06:00 brief · marketing</span>
            <button onClick={() => go("marketing")} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-gold-300">all ideas →</button>
          </div>
          {digestBusy ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="thinking-bar h-9 rounded-md" />)}</div>
          ) : ideas.length === 0 ? (
            <p className="text-xs text-ink-faint">No ideas yet today — the 06:00 trigger generates 2–3, reasoned from live metrics.</p>
          ) : ideas.map((idea, i) => (
            <div key={idea.id} className="rv group border-b border-plum-800 py-2.5 last:border-0" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold leading-snug text-ink">{idea.title}</div>
                <Chip tone="rani">{idea.channel}</Chip>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-dim">{idea.rationale}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button onClick={() => onBrief(idea.id)} disabled={briefing === idea.id || idea.status === "briefed"}
                  className="font-mono text-[10px] uppercase tracking-wider text-gold-400 transition-colors hover:text-gold-300 disabled:text-ink-faint">
                  {idea.status === "briefed" ? "✓ briefed" : briefing === idea.id ? "writing brief…" : "write brief →"}
                </button>
                <button onClick={() => setTraceFor({ title: idea.title, steps: idea.trace, engine: idea.engine })}
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-gold-300">why?</button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-plum-700/50 p-5 lg:col-span-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="tick flex items-center gap-1.5 text-gold-300"><Icon name="send" size={12} /> overnight · sales</span>
            <button onClick={() => go("sales")} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-gold-300">pipeline →</button>
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <div className="font-display text-4xl font-bold text-gold-300">{s.drafts.filter((d) => d.status === "ready").length}</div>
              <div className="tick mt-0.5">drafts ready</div>
            </div>
            <div>
              <div className="font-display text-4xl font-bold text-ink">{s.leads.filter((l) => Date.now() - new Date(l.lastActivity).getTime() < 86400000).length}</div>
              <div className="tick mt-0.5">active in 24h</div>
            </div>
          </div>
          {s.digest?.salesSummary.topLeadId && (
            <div className="mt-3 rounded-lg border border-gold-500/20 bg-plum-950/50 p-3">
              <div className="tick mb-1">highest-fit open lead</div>
              <div className="text-xs leading-relaxed text-ink-dim">{s.digest.salesSummary.topLeadNote}</div>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">Every draft sits in your queue — Gmail opens pre-filled, you press send.</p>
        </div>

        <div className="p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="tick flex items-center gap-1.5 text-teal-300"><Icon name="pulse" size={12} /> ops · risk watch</span>
            <button onClick={() => go("ops")} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-gold-300">register →</button>
          </div>
          <div className="space-y-2">
            {openRisks.slice(0, 3).map((r) => (
              <button key={r.id} onClick={() => go("ops")} className="flex w-full items-start gap-2 rounded-lg border border-plum-700/60 bg-plum-950/40 p-2.5 text-left transition-colors hover:border-teal-500/40">
                <SevBadge level={r.severity} />
                <span className="min-w-0 flex-1 truncate text-xs text-ink-dim">{r.title}</span>
              </button>
            ))}
            {openRisks.length === 0 && <p className="text-xs text-ink-faint">All accounts inside pattern. Scan runs every 12h.</p>}
          </div>
          {expiring.length > 0 && (
            <button onClick={() => go("vault")} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-saffron-400/30 bg-saffron-500/10 p-2.5 text-left transition-colors hover:bg-saffron-500/15">
              <Icon name="calendar" size={13} className="text-saffron-300" />
              <span className="text-[11px] text-saffron-300">{expiring.length} document{expiring.length > 1 ? "s" : ""} in renewal window</span>
            </button>
          )}
        </div>
      </section>

      {/* queue + funnel | activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="rv panel panel-hover p-5" style={{ animationDelay: "0.16s" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-gold-200">Ready to send</h2>
              <Chip tone="dim"><Icon name="lock" size={10} /> drafts only — you send</Chip>
            </div>
            {readyDrafts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-plum-600/60 p-6 text-center">
                <p className="text-sm text-ink-faint">Queue is clear. Open a lead in Sales and run <span className="text-gold-300">Draft outreach</span> — the agent reasons over their record first.</p>
                <Btn variant="outline" size="sm" className="mt-3" onClick={() => go("sales")}>Open pipeline <Icon name="arrow" size={12} /></Btn>
              </div>
            ) : readyDrafts.map((d, i) => <DraftRow key={d.id} d={d} i={i} onWhy={() => setTraceFor({ title: d.subject, steps: d.trace, engine: d.engine })} />)}
          </section>

          <section className="rv panel panel-hover p-5" style={{ animationDelay: "0.22s" }}>
            <h2 className="mb-4 font-display text-xl text-gold-200">Pipeline shape</h2>
            <div className="space-y-2.5">
              {stages.map(([name, count], i) => (
                <div key={name} className="grid grid-cols-[90px_1fr_28px] items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{name}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-plum-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-1000"
                      style={{ width: `${Math.max(3, (count / Math.max(1, s.leads.length)) * 100)}%`, transitionDelay: `${i * 90}ms` }} />
                  </div>
                  <span className="text-right font-mono text-xs text-gold-300">{count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rv panel p-5 lg:col-span-1" style={{ animationDelay: "0.2s" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-gold-200">Agent activity</h2>
            <span className="pulse-dot h-2 w-2 rounded-full bg-gold-400" />
          </div>
          <div className="max-h-[430px] space-y-1 overflow-y-auto pr-1">
            {s.activity.slice(0, 14).map((a, i) => {
              const tone = AGENT_TONES[a.agent];
              return (
                <ActivityRow key={a.id} i={i} tone={tone} a={a} onWhy={() => setTraceFor({ title: `${a.agent} · ${a.action}`, steps: a.trace, engine: a.engine })} />
              );
            })}
          </div>
        </section>
      </div>

      {/* stats strip */}
      <section className="rv panel grid grid-cols-2 divide-plum-700/50 md:grid-cols-4 md:divide-x" style={{ animationDelay: "0.28s" }}>
        {[
          { label: "weighted pipeline / yr", value: fmtLakh(pipelineValue), sub: `${s.leads.length} leads in register` },
          { label: "live campaigns", value: String(s.campaigns.filter((c) => c.status === "live").length), sub: `${s.campaigns.filter((c) => c.status === "proposed").length} proposed, spend uncommitted` },
          { label: "open ops risks", value: String(openRisks.length), sub: `${escalated.length} escalated · scan ${s.lastOpsScan ? timeAgo(s.lastOpsScan) : "never"}` },
          { label: "vault documents", value: String(s.documents.length), sub: `${expiring.length} expiring ≤ 30 days` },
        ].map((st, i) => (
          <div key={i} className="p-5">
            <div className="font-display text-3xl font-bold text-ink">{st.value}</div>
            <div className="tick mt-1">{st.label}</div>
            <div className="mt-1 text-[11px] text-ink-faint">{st.sub}</div>
          </div>
        ))}
      </section>

      <Modal open={!!traceFor} onClose={() => setTraceFor(null)} title="Why this output?">
        {traceFor && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-dim">{traceFor.title}</p>
            <Trace steps={traceFor.steps} engine={traceFor.engine} />
            <p className="text-[11px] text-ink-faint">Guardrail 4 — every agent output is explainable. This is the actual data trail, not a restated conclusion.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DraftRow({ d, i, onWhy }: { d: Draft; i: number; onWhy: () => void }) {
  const s = useApp();
  const lead = s.leads.find((l) => l.id === d.leadId);
  return (
    <div className="rv flex flex-wrap items-center gap-3 rounded-lg border border-plum-700/60 bg-plum-950/40 p-3 transition-colors hover:border-gold-500/40" style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{d.subject}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
          <span>{lead?.planner ?? "—"} · {lead?.city}</span>
          <Chip tone="gold">{d.tierPitch}</Chip>
          <Chip tone="dim">{d.angle}</Chip>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Btn size="sm" variant="ghost" onClick={onWhy} title="See the reasoning trail">why?</Btn>
        <Btn size="sm" variant="outline" onClick={() => {
          if (lead) window.open(gmailUrl(lead.email, d.subject, d.body), "_blank");
          toast("Gmail compose opened — nothing sends until you do.", "teal");
        }}>
          <Icon name="mail" size={12} /> Open in Gmail
        </Btn>
      </div>
    </div>
  );
}

function ActivityRow({ a, tone, i, onWhy }: { a: { id: string; ts: string; agent: string; action: string; summary: string; trace: string[]; engine: string }; tone: { text: string; dot: string }; i: number; onWhy: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rv-slide rounded-lg px-2 py-2 transition-colors hover:bg-plum-850/70" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-wider ${tone.text}`}>{a.agent} · {a.action}</span>
            <span className="shrink-0 font-mono text-[10px] text-ink-faint">{timeAgo(a.ts)}</span>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-ink-dim">{a.summary}</p>
          {a.trace?.length > 0 && (
            <button onClick={() => (open ? setOpen(false) : onWhy())} className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-gold-300">
              {open ? "hide why" : "why?"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
