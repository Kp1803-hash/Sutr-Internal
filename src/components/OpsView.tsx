import { useState } from "react";
import { useApp, updateRisk, updateLead, fmtDate } from "../lib/store";
import type { OpsRisk } from "../lib/store";
import { runOpsScan } from "../lib/agents";
import { Btn, Chip, Icon, SevBadge, Trace, toast, useStagedRun, Thinking, Bar } from "./ui";

export default function OpsView() {
  const s = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);

  const scan = useStagedRun(
    ["reading onboarding pipeline + setup curves", "checking event timelines against SLA doc-12", "matching churn signature from Q3 postmortem", "weighing severity + cross-agent impact"],
    async () => {
      const { risks, escalated } = await runOpsScan();
      if (risks.length === 0) toast("Scan complete — no new risks. All accounts inside pattern.", "teal");
      else toast(`${risks.length} new risk${risks.length > 1 ? "s" : ""} flagged${escalated.length ? ` — ${escalated.length} escalated immediately` : ""}.`, escalated.length ? "rani" : "gold");
    }
  );

  const open = s.risks.filter((r) => r.status !== "resolved").sort((a, b) => b.severity - a.severity || b.createdAt.localeCompare(a.createdAt));
  const resolved = s.risks.filter((r) => r.status === "resolved");

  return (
    <div className="space-y-5">
      <header className="rv flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tick mb-1">agent 03 · operations · sutr</div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Risk register & account health</h1>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="teal"><Icon name="bolt" size={10} /> severity 3 escalates immediately — never batched</Chip>
          <Btn onClick={scan.trigger} disabled={scan.running}><Icon name="refresh" size={13} /> {scan.running ? "Scanning…" : "Run scan now"}</Btn>
        </div>
      </header>

      {scan.running && <Thinking stages={["reading onboarding pipeline + setup curves", "checking event timelines against SLA doc-12", "matching churn signature from Q3 postmortem", "weighing severity + cross-agent impact"]} stage={scan.stage} />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* risk register */}
        <section className="rv panel p-5 lg:col-span-2" style={{ animationDelay: "0.08s" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-gold-200">Open risks</h2>
            <span className="font-mono text-xs text-ink-faint">{open.length} open · {resolved.length} resolved</span>
          </div>
          {open.length === 0 && (
            <p className="rounded-lg border border-dashed border-plum-600/60 p-6 text-center text-xs text-ink-faint">
              No open risks. The agent re-scans every 12 hours — every flag it raises will carry a data trail, never speculation.
            </p>
          )}
          <div className="space-y-2.5">
            {open.map((r, i) => (
              <RiskRow key={r.id} r={r} i={i} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
            ))}
          </div>
          {resolved.length > 0 && (
            <div className="mt-4 border-t border-plum-700/50 pt-3">
              <span className="tick">resolved</span>
              <div className="mt-2 space-y-1">
                {resolved.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-[11px] text-ink-faint">
                    <Icon name="check" size={11} className="text-teal-400" />
                    <span className="line-through opacity-70">{r.title}</span>
                    <span className="ml-auto font-mono">{r.resolvedAt ? fmtDate(r.resolvedAt) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* account health */}
        <section className="rv panel p-5" style={{ animationDelay: "0.14s" }}>
          <h2 className="mb-4 font-display text-xl text-gold-200">Onboarded planners</h2>
          <div className="space-y-3">
            {s.accounts.map((a, i) => {
              const risk = open.find((r) => r.entityId === a.id);
              return (
                <div key={a.id} className={`rv-scale rounded-lg border p-3.5 ${risk?.severity === 3 ? "border-rani-500/50 bg-rani-500/5" : risk ? "border-saffron-400/40 bg-saffron-500/5" : "border-plum-700/60 bg-plum-950/40"}`} style={{ animationDelay: `${0.18 + i * 0.06}s` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-ink">{a.name}</div>
                      <div className="text-[11px] text-ink-faint">{a.city} · {a.tier} · day {Math.round((Date.now() - new Date(a.onboardedAt).getTime()) / 86400000)}</div>
                    </div>
                    {risk ? <SevBadge level={risk.severity} /> : <Chip tone="teal"><Icon name="check" size={9} /> healthy</Chip>}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Bar value={a.setupPct} max={100} tone={a.setupPct < 60 ? "rani" : "teal"} />
                    <span className="font-mono text-[11px] text-ink-dim">{a.setupPct}%</span>
                  </div>
                  <div className="tick mt-1">setup complete</div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-ink-faint">
                    <span>inactive {a.lastActiveDays}d</span>
                    <span>{a.openTickets} ticket{a.openTickets === 1 ? "" : "s"}</span>
                    <span>{a.activeEvents} event{a.activeEvents === 1 ? "" : "s"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function RiskRow({ r, expanded, onToggle, i }: { r: OpsRisk; expanded: boolean; onToggle: () => void; i: number }) {
  const s = useApp();
  const linkedLead = s.accounts.find((a) => a.id === r.entityId)?.linkedLeadId
    ? s.leads.find((l) => l.id === s.accounts.find((a) => a.id === r.entityId)?.linkedLeadId)
    : undefined;
  const holdActive = linkedLead?.status === "nurture";

  return (
    <div className={`rv overflow-hidden rounded-lg border transition-colors ${r.severity === 3 ? "border-rani-500/50" : r.severity === 2 ? "border-saffron-400/35" : "border-plum-700/60"} bg-plum-950/40`} style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-plum-850/50">
        <SevBadge level={r.severity} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{r.title}</div>
          <div className="text-[11px] text-ink-faint">{r.entity} · {r.category} · {r.status === "escalated" ? "escalated immediately" : "open"} · refs {r.refs.join(", ")}</div>
        </div>
        <Icon name="chevron" size={15} className={`text-ink-faint transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="rv-scale space-y-3 border-t border-plum-800 px-4 py-4">
          <div>
            <div className="tick mb-1.5">evidence — the data trail</div>
            <ul className="space-y-1">
              {r.evidence.map((e, j) => (
                <li key={j} className="flex gap-2 text-xs text-ink-dim"><span className="text-gold-500">·</span>{e}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-plum-700/70 bg-plum-900/60 p-3">
              <div className="tick mb-1">why the data suggests this</div>
              <p className="text-xs leading-relaxed text-ink-dim">{r.why}</p>
            </div>
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3">
              <div className="tick mb-1 text-teal-300">recommended next step</div>
              <p className="text-xs leading-relaxed text-ink-dim">{r.recommendation}</p>
            </div>
          </div>
          <Trace steps={r.trace} engine={r.engine} />
          <div className="flex flex-wrap gap-2">
            {r.status === "open" && (
              <Btn size="sm" variant="rani" onClick={() => { updateRisk(r.id, { status: "escalated" }); toast("Escalated — this now leads the dashboard.", "rani"); }}>
                <Icon name="alert" size={12} /> Escalate
              </Btn>
            )}
            {linkedLead && !holdActive && (
              <Btn size="sm" variant="outline" onClick={() => {
                updateLead(linkedLead.id, {
                  status: "nurture",
                  notes: [...linkedLead.notes, "OPS HOLD: churn risk open — do not pitch until onboarding recovers."],
                  history: [...linkedLead.history, { ts: new Date().toISOString(), note: "Sales pitch held manually from Ops register." }],
                });
                toast(`Sales told to hold the ${linkedLead.planner} pitch — shared store updated.`, "teal");
              }}><Icon name="send" size={12} /> Tell Sales to hold pitch</Btn>
            )}
            {linkedLead && holdActive && <Chip tone="dim"><Icon name="check" size={9} /> sales pitch already held</Chip>}
            <Btn size="sm" variant="teal" onClick={() => { updateRisk(r.id, { status: "resolved", resolvedAt: new Date().toISOString() }); toast("Risk resolved.", "teal"); }}>
              <Icon name="check" size={12} /> Mark resolved
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
