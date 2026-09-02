import { useState } from "react";
import { useApp, updateIdea, fmtINR } from "../lib/store";
import type { Campaign, Idea } from "../lib/store";
import { morningIdeas, diagnoseCampaign, writeBrief, seasonality } from "../lib/agents";
import { Btn, Chip, Icon, Modal, Trace, toast, useStagedRun, Thinking } from "./ui";

type Diagnosis = { verdict: string; ctr: string; avgCtr: string; why: string; fixes: string[]; trace: string[] };

export default function MarketingView() {
  const s = useApp();
  const [diagFor, setDiagFor] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [briefView, setBriefView] = useState<Idea | null>(null);
  const [traceFor, setTraceFor] = useState<{ title: string; steps: string[]; engine?: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const ideas = s.ideas.filter((i) => i.status !== "dismissed" && i.date === today);
  const olderIdeas = s.ideas.filter((i) => i.status !== "dismissed" && i.date !== today).slice(0, 3);

  const gen = useStagedRun(
    ["reading live campaign metrics", "reading seasonality + competitive docs from vault", "checking which segments Sales actually converts", "reasoning 3 channel-fit ideas"],
    async () => {
      const list = await morningIdeas();
      toast(`${list.length} ideas generated — every one cites store data.`);
    }
  );

  const diagRun = useStagedRun(
    ["pulling campaign metrics vs portfolio average", "checking channel-to-goal fit", "writing the why, not just the numbers"],
    async () => {
      if (!diagFor) return;
      setDiag(await diagnoseCampaign(diagFor));
    }
  );

  const live = s.campaigns.filter((c) => c.status === "live");
  const totImp = live.reduce((a, c) => a + c.metrics.impressions, 0);
  const totClk = live.reduce((a, c) => a + c.metrics.clicks, 0);
  const avgCtr = totImp ? (totClk / totImp) * 100 : 0;

  return (
    <div className="space-y-5">
      <header className="rv flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tick mb-1">agent 02 · marketing · sutr</div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Campaigns & the 06:00 brief</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="dim"><Icon name="shield" size={10} /> budgets proposed — never committed</Chip>
          <Chip tone="rani"><Icon name="calendar" size={10} /> {seasonality.phase}</Chip>
          <Btn onClick={gen.trigger} disabled={gen.running}><Icon name="refresh" size={13} /> {gen.running ? "Reasoning…" : "Run brief now"}</Btn>
        </div>
      </header>

      <p className="rv -mt-2 text-xs text-ink-faint" style={{ animationDelay: "0.05s" }}>
        Seasonality read: {seasonality.note}
      </p>

      {gen.running && <Thinking stages={["reading live campaign metrics", "reading seasonality + competitive docs from vault", "checking which segments Sales actually converts", "reasoning 3 channel-fit ideas"]} stage={gen.stage} />}

      {/* ideas */}
      <section className="rv panel p-5" style={{ animationDelay: "0.1s" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-gold-200">Today's ideas <span className="text-sm text-ink-faint">· grounded in live metrics, not recycled</span></h2>
          <Chip tone="rani">{ideas.length} for {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Chip>
        </div>
        {ideas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-plum-600/60 p-5 text-center text-xs text-ink-faint">
            No brief yet today. It auto-generates at 06:00 from campaign performance, {seasonality.phase} seasonality and Meragi/WedMeGood moves in the vault — or run it now above.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {ideas.map((idea, i) => (
              <div key={idea.id} className="rv-scale flex flex-col rounded-lg border border-rani-500/25 bg-plum-950/50 p-4" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-rani-300">idea {String(i + 1).padStart(2, "0")}</span>
                  <Chip tone="rani">{idea.channel}</Chip>
                </div>
                <h3 className="mt-2 font-display text-lg leading-snug text-ink">{idea.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-dim">{idea.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-1">{idea.groundedIn.map((g) => <Chip key={g} tone="dim">{g}</Chip>)}</div>
                <div className="mt-2 text-[11px] text-saffron-300">{idea.costEstimate}</div>
                <div className="mt-3 flex items-center gap-2 border-t border-plum-700/60 pt-3">
                  {idea.status === "briefed" ? (
                    <Btn size="sm" variant="teal" onClick={() => setBriefView(idea)}><Icon name="eye" size={12} /> View brief</Btn>
                  ) : (
                    <Btn size="sm" onClick={async () => { const updated = await writeBrief(idea.id); setBriefView(updated); toast("Brief written — budget is proposed only."); }}>
                      <Icon name="wand" size={12} /> Write full brief
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={() => setTraceFor({ title: idea.title, steps: idea.trace, engine: idea.engine })}>why?</Btn>
                  <Btn size="sm" variant="ghost" className="ml-auto" title="Dismiss idea" onClick={() => { updateIdea(idea.id, { status: "dismissed" }); toast("Idea dismissed."); }}>
                    <Icon name="x" size={12} />
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        {olderIdeas.length > 0 && (
          <div className="mt-4 border-t border-plum-700/50 pt-3">
            <span className="tick">earlier this week</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {olderIdeas.map((i) => (
                <Chip key={i.id} tone="dim">{i.channel} · {i.title.slice(0, 44)}…</Chip>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* campaigns */}
      <section className="rv panel p-5" style={{ animationDelay: "0.16s" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-gold-200">Live campaign read</h2>
          <span className="font-mono text-xs text-ink-faint">portfolio avg CTR {avgCtr.toFixed(2)}%</span>
        </div>
        <div className="space-y-3">
          {s.campaigns.map((c) => (
            <CampaignRow key={c.id} c={c} avg={avgCtr}
              onDiagnose={() => { setDiagFor(c.id); setDiag(null); diagRun.trigger(); }}
              diag={diagFor === c.id ? diag : null}
              thinking={diagFor === c.id && diagRun.running}
              stage={diagRun.stage}
              onWhy={(d) => setTraceFor({ title: `"${c.name}" diagnosis`, steps: d.trace })}
              onBriefView={() => {}}
              onViewBrief={(i) => setBriefView(i)}
            />
          ))}
        </div>
      </section>

      {/* diagnosis thinking */}
      <Modal open={!!traceFor} onClose={() => setTraceFor(null)} title="Why this call?">
        {traceFor && <div className="space-y-3"><p className="text-sm text-ink-dim">{traceFor.title}</p><Trace steps={traceFor.steps} engine={traceFor.engine} /></div>}
      </Modal>
      <BriefModal idea={briefView} onClose={() => setBriefView(null)} />
    </div>
  );
}

function CampaignRow({ c, avg, onDiagnose, diag, thinking, stage, onWhy }: {
  c: Campaign; avg: number; onDiagnose: () => void; diag: Diagnosis | null; thinking: boolean; stage: number;
  onWhy: (d: Diagnosis) => void; onBriefView: () => void; onViewBrief: (i: Idea) => void;
}) {
  const ctr = c.metrics.impressions ? (c.metrics.clicks / c.metrics.impressions) * 100 : 0;
  const under = c.status === "live" && ctr < avg * 0.6;
  const tones: Record<string, string> = { LinkedIn: "gold", Instagram: "rani", WhatsApp: "teal", Community: "plum", SEO: "gold" };
  return (
    <div className={`rounded-lg border p-4 transition-colors ${under ? "border-rani-500/40 bg-rani-500/5" : "border-plum-700/60 bg-plum-950/40"} hover:border-gold-500/30`}>
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={tones[c.channel]}>{c.channel}</Chip>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{c.name}</div>
          <div className="text-[11px] text-ink-faint">goal: {c.goal}</div>
        </div>
        <Chip tone={c.status === "live" ? "teal" : "dim"}>{c.status}</Chip>
        {c.proposedBudget > 0 && <Chip tone="dim">{fmtINR(c.proposedBudget)} proposed</Chip>}
        <Btn size="sm" variant="outline" onClick={onDiagnose} disabled={thinking}>
          <Icon name="pulse" size={12} /> {thinking ? "diagnosing…" : "diagnose"}
        </Btn>
      </div>
      {c.status === "live" && c.metrics.impressions > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="impressions" v={c.metrics.impressions.toLocaleString("en-IN")} />
          <Metric label="CTR" v={ctr.toFixed(2) + "%"} tone={under ? "text-rani-300" : ctr > avg ? "text-teal-300" : "text-gold-300"} />
          <Metric label="replies" v={String(c.metrics.replies)} />
          <Metric label="leads" v={String(c.metrics.leads)} />
        </div>
      )}
      {c.status === "live" && c.metrics.impressions > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-plum-800">
            <div className={`h-full rounded-full transition-all duration-700 ${under ? "bg-rani-400" : "bg-teal-400"}`} style={{ width: `${Math.min(100, (ctr / Math.max(0.1, avg * 1.6)) * 100)}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-gold-400" style={{ left: `${Math.min(98, (avg / Math.max(0.1, avg * 1.6)) * 100)}%` }} title="portfolio average" />
          </div>
          <span className="font-mono text-[10px] text-ink-faint">gold line = portfolio avg</span>
        </div>
      )}
      {c.status === "proposed" && (
        <p className="mt-2 text-[11px] text-ink-faint">Starts {new Date(c.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · budget stays proposed until you commit — guardrail 2.</p>
      )}
      {thinking && <div className="mt-3"><Thinking stages={["pulling campaign metrics vs portfolio average", "checking channel-to-goal fit", "writing the why, not just the numbers"]} stage={stage} /></div>}
      {diag && (
        <div className="rv-scale mt-3 rounded-lg border border-plum-700/70 bg-plum-950/70 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={diag.verdict === "underperforming" ? "danger" : diag.verdict === "promising" ? "teal" : "gold"}>{diag.verdict}</Chip>
            <span className="font-mono text-[11px] text-ink-dim">CTR {diag.ctr} vs avg {diag.avgCtr}</span>
            <button onClick={() => onWhy(diag)} className="ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-faint hover:text-gold-300">trace →</button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-dim">{diag.why}</p>
          <ul className="mt-2 space-y-1">
            {diag.fixes.map((f, i) => <li key={i} className="flex gap-2 text-[11px] text-ink-dim"><span className="text-gold-500">→</span>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, v, tone = "text-ink" }: { label: string; v: string; tone?: string }) {
  return (
    <div>
      <div className={`font-mono text-sm font-semibold ${tone}`}>{v}</div>
      <div className="tick">{label}</div>
    </div>
  );
}

function BriefModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  if (!idea || !idea.brief) return null;
  const b = idea.brief;
  const rows: [string, string][] = [
    ["Objective", b.objective], ["Audience", b.audience], ["Channel", b.channel],
    ["Message", b.message], ["Format", b.format], ["Proposed budget", b.proposedBudget],
    ["Success metric", b.kpi], ["Voice (from brand doc)", b.voice], ["Timeline", b.timeline],
  ];
  return (
    <Modal open onClose={onClose} title={<span>Creative brief — <span className="text-sm text-ink-faint">{idea.title.slice(0, 40)}…</span></span>} wide>
      <div className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-plum-800/70 pb-2.5">
            <span className="tick pt-0.5">{k}</span>
            <span className="text-xs leading-relaxed text-ink-dim">{v}</span>
          </div>
        ))}
        <div className="rounded-lg border border-rani-500/30 bg-rani-500/10 p-3 text-[11px] text-rani-300">
          <Icon name="shield" size={11} className="mr-1 inline" /> Guardrail 2: this budget is a proposal. Marketing never commits ad spend — approval and payment stay with you.
        </div>
      </div>
    </Modal>
  );
}
