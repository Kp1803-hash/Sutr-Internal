import { useState } from "react";
import { useApp, updateLead, updateDraft, fmtINR, timeAgo, fmtDate } from "../lib/store";
import type { Draft, Lead, Stage } from "../lib/store";
import { draftOutreach, nextBestAction, qualifyNewLead, computeFit } from "../lib/agents";
import { Btn, Chip, Icon, Modal, Trace, toast, useStagedRun, Thinking } from "./ui";

const STAGE_TONES: Record<Stage, string> = {
  new: "plum", qualified: "gold", drafted: "gold", engaged: "teal", nurture: "dim", won: "teal", lost: "danger",
};

function gmailUrl(email: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function SalesView() {
  const s = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [draftFor, setDraftFor] = useState<Draft | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const lead = s.leads.find((l) => l.id === selected) ?? null;
  const ready = s.drafts.filter((d) => d.status === "ready" || d.status === "opened");

  return (
    <div className="space-y-5">
      <header className="rv flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tick mb-1">agent 01 · sales · sutr</div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Planner pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="dim"><Icon name="lock" size={10} /> Gmail drafts only — never auto-sent</Chip>
          <Btn onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Feed a lead</Btn>
        </div>
      </header>

      {/* send queue */}
      <section className="rv panel p-4" style={{ animationDelay: "0.06s" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="tick text-gold-300">daily “ready to send” queue</span>
          <span className="font-mono text-xs text-ink-faint">{ready.length} waiting on you</span>
        </div>
        {ready.length === 0 ? (
          <p className="text-xs text-ink-faint">Nothing queued. Run <span className="text-gold-300">Draft outreach</span> on any lead below — the agent reads their record, linked account, comparables and the season before writing a word.</p>
        ) : (
          <div className="space-y-2">
            {ready.map((d) => {
              const l = s.leads.find((x) => x.id === d.leadId);
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gold-500/20 bg-plum-950/50 px-3 py-2.5">
                  <Icon name="mail" size={15} className="text-gold-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{d.subject}</div>
                    <div className="text-[11px] text-ink-faint">{l?.planner} · {l?.owner} · {l?.city} · {timeAgo(d.createdAt)}</div>
                  </div>
                  <Chip tone="gold">{d.tierPitch}</Chip>
                  <Btn size="sm" variant="outline" onClick={() => setDraftFor(d)}><Icon name="eye" size={12} /> Review</Btn>
                  <Btn size="sm" onClick={() => {
                    if (l) window.open(gmailUrl(l.email, d.subject, d.body), "_blank");
                    toast("Gmail compose opened with the draft — send is yours.", "teal");
                  }}><Icon name="external" size={12} /> Gmail</Btn>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* lead register */}
      <section className="rv panel overflow-hidden" style={{ animationDelay: "0.12s" }}>
        <div className="hidden grid-cols-[1.4fr_0.6fr_0.7fr_0.9fr_0.5fr_0.7fr_auto] gap-3 border-b border-plum-700/60 bg-plum-950/40 px-4 py-2.5 md:grid">
          {["planner", "city", "events/yr", "tools today", "fit", "stage", ""].map((h) => (
            <span key={h} className="tick">{h}</span>
          ))}
        </div>
        {[...s.leads].sort((a, b) => b.fitScore - a.fitScore).map((l, i) => {
          const opsHold = l.notes.some((n) => /OPS HOLD/i.test(n));
          return (
            <button key={l.id} onClick={() => setSelected(l.id)}
              className="rv grid w-full grid-cols-2 items-center gap-3 border-b border-plum-800/70 px-4 py-3 text-left transition-colors last:border-0 hover:bg-plum-850/60 md:grid-cols-[1.4fr_0.6fr_0.7fr_0.9fr_0.5fr_0.7fr_auto]"
              style={{ animationDelay: `${0.14 + i * 0.04}s` }}>
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {l.planner}
                  {opsHold && <Chip tone="danger"><Icon name="alert" size={9} /> ops hold</Chip>}
                </div>
                <div className="text-[11px] text-ink-faint">{l.owner} · via {l.source.split("—")[0].trim()}</div>
              </div>
              <span className="text-xs text-ink-dim">{l.city}</span>
              <span className="font-mono text-xs text-gold-300">{l.eventsPerYear}</span>
              <div className="flex flex-wrap gap-1">
                {l.currentTools.slice(0, 2).map((t) => <Chip key={t} tone="dim">{t.split(" ")[0]}</Chip>)}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-plum-800">
                  <div className="h-full rounded-full bg-gold-400" style={{ width: l.fitScore + "%" }} />
                </div>
                <span className="font-mono text-[11px] text-gold-300">{l.fitScore}</span>
              </div>
              <Chip tone={STAGE_TONES[l.status]}>{l.status}</Chip>
              <Icon name="chevron" size={14} className="hidden -rotate-90 text-ink-faint md:block" />
            </button>
          );
        })}
      </section>

      <LeadModal lead={lead} onClose={() => setSelected(null)} onDraft={(d) => setDraftFor(d)} />
      <DraftModal d={draftFor} onClose={() => setDraftFor(null)} />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} onDone={(l) => { setSelected(l.id); toast(`${l.planner} qualified: fit ${l.fitScore}/100 → ${l.tierFit} tier.`, "teal"); }} />
    </div>
  );
}

/* ---------- lead detail ---------- */

function LeadModal({ lead, onClose, onDraft }: { lead: Lead | null; onClose: () => void; onDraft: (d: Draft) => void }) {
  const s = useApp();
  const [nba, setNba] = useState<{ action: string; detail: string; trace: string[] } | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const draft = useStagedRun(
    ["gathering context from shared store", "reading lead record + linked account", "weighing comparables, seasonality, competitive docs", "drafting a grounded email"],
    async () => {
      if (!lead) return;
      const d = await draftOutreach(lead.id);
      onDraft(d);
      toast("Draft queued — reviewed against their record, not a template.");
    }
  );
  const nbaRun = useStagedRun(
    ["reading lead history + last activity", "checking linked account health", "deciding: follow-up · nurture · deprioritize"],
    async () => {
      if (!lead) return;
      setNba(await nextBestAction(lead.id));
    }
  );

  if (!lead) return null;
  const fit = computeFit(lead);
  const linked = s.accounts.find((a) => a.linkedLeadId === lead.id);
  const drafts = s.drafts.filter((d) => d.leadId === lead.id);

  return (
    <Modal open onClose={onClose} title={<span>{lead.planner} <span className="text-sm text-ink-faint">· {lead.owner}, {lead.city}</span></span>} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Fact label="events / year" value={String(lead.eventsPerYear)} />
            <Fact label="team size" value={String(lead.teamSize)} />
            <Fact label="email" value={lead.email} />
            <Fact label="source" value={lead.source} />
          </div>
          <div>
            <div className="tick mb-1.5">tools today</div>
            <div className="flex flex-wrap gap-1.5">{lead.currentTools.map((t) => <Chip key={t} tone="plum">{t}</Chip>)}</div>
          </div>
          <div>
            <div className="tick mb-1.5">field notes</div>
            <ul className="space-y-1.5">
              {lead.notes.map((n, i) => (
                <li key={i} className={`text-xs leading-relaxed ${/OPS HOLD/i.test(n) ? "rounded border border-rani-500/40 bg-rani-500/10 p-2 text-rani-300" : "text-ink-dim"}`}>{n}</li>
              ))}
            </ul>
          </div>
          {linked && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3">
              <div className="tick mb-1 text-teal-300">linked customer account — {linked.id}</div>
              <div className="text-xs text-ink-dim">{linked.name} · {linked.tier} tier · setup {linked.setupPct}% · inactive {linked.lastActiveDays}d</div>
              <div className="mt-1 text-[11px] text-ink-faint">Shared store: Ops flags on this account steer what Sales says here.</div>
            </div>
          )}
          <div>
            <div className="tick mb-1.5">history</div>
            <ol className="space-y-1">
              {[...lead.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-ink-faint"><span className="shrink-0 font-mono">{fmtDate(h.ts)}</span>{h.note}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gold-500/25 bg-plum-950/60 p-4">
            <div className="flex items-baseline justify-between">
              <span className="tick">agent fit read</span>
              <span className="font-display text-3xl font-bold text-gold-300">{fit.score}<span className="text-sm text-ink-faint">/100</span></span>
            </div>
            <div className="mt-1 flex items-center gap-2"><Chip tone="gold">{fit.tier} · {fmtINR(fit.tier === "Starter" ? 9000 : fit.tier === "Studio" ? 14000 : fit.tier === "Growth" ? 24000 : 40000)}/event</Chip></div>
            <button onClick={() => setShowTrace(!showTrace)} className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint hover:text-gold-300">
              {showTrace ? "hide drivers" : "score drivers →"}
            </button>
            {showTrace && <ul className="mt-2 space-y-1 text-[11px] text-ink-dim">{fit.drivers.map((d, i) => <li key={i}>· {d}</li>)}</ul>}
          </div>

          <div className="space-y-2">
            <label className="tick">stage</label>
            <div className="flex flex-wrap gap-1.5">
              {(["new", "qualified", "drafted", "engaged", "nurture", "won", "lost"] as Stage[]).map((st) => (
                <button key={st} onClick={() => { updateLead(lead.id, { status: st, lastActivity: new Date().toISOString(), history: [...lead.history, { ts: new Date().toISOString(), note: `Stage set to ${st} by Priya.` }] }); toast(`Stage → ${st}`); }}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all ${lead.status === st ? "border-gold-400 bg-gold-500/20 text-gold-200" : "border-plum-600 text-ink-faint hover:border-gold-500/50 hover:text-gold-300"}`}>
                  {st}
                </button>
              ))}
            </div>
          </div>

          {draft.running && <Thinking stages={["gathering context from shared store", "reading lead record + linked account", "weighing comparables, seasonality, competitive docs", "drafting a grounded email"]} stage={draft.stage} />}
          {nbaRun.running && <Thinking stages={["reading lead history + last activity", "checking linked account health", "deciding: follow-up · nurture · deprioritize"]} stage={nbaRun.stage} />}

          {nba && (
            <div className="rv-scale rounded-lg border border-teal-500/30 bg-teal-500/10 p-3.5">
              <div className="tick mb-1 text-teal-300">next best action · {nba.action}</div>
              <p className="text-xs leading-relaxed text-ink-dim">{nba.detail}</p>
              <div className="mt-2"><Trace steps={nba.trace} engine="ondevice" /></div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Btn onClick={draft.trigger} disabled={draft.running}><Icon name="wand" size={13} /> Draft outreach</Btn>
            <Btn variant="outline" onClick={nbaRun.trigger} disabled={nbaRun.running}><Icon name="bolt" size={13} /> Next best action</Btn>
          </div>

          {drafts.length > 0 && (
            <div>
              <div className="tick mb-1.5">drafts for this lead</div>
              {drafts.map((d) => (
                <div key={d.id} className="mb-1.5 flex items-center gap-2 rounded border border-plum-700/70 bg-plum-950/50 px-2.5 py-2 text-xs">
                  <Chip tone={d.status === "sent" ? "teal" : d.status === "discarded" ? "dim" : "gold"}>{d.status}</Chip>
                  <span className="min-w-0 flex-1 truncate text-ink-dim">{d.subject}</span>
                  <Btn size="sm" variant="ghost" onClick={() => onDraft(d)}>open</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-plum-700/70 bg-plum-950/50 p-2.5">
      <div className="tick">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-ink">{value}</div>
    </div>
  );
}

/* ---------- draft review ---------- */

function DraftModal({ d, onClose }: { d: Draft | null; onClose: () => void }) {
  const s = useApp();
  if (!d) return null;
  const lead = s.leads.find((l) => l.id === d.leadId);
  return (
    <Modal open onClose={onClose} title="Draft review — nothing sends without you" wide>
      <div className="space-y-4">
        <div className="rounded-lg border border-plum-700/70 bg-plum-950/60 p-4">
          <div className="space-y-1 border-b border-plum-700/60 pb-3 font-mono text-[11px] text-ink-faint">
            <div><span className="text-ink-dim">To:</span> {lead?.planner} &lt;{lead?.email}&gt;</div>
            <div><span className="text-ink-dim">Subject:</span> <span className="font-semibold text-gold-200">{d.subject}</span></div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-body text-[13px] leading-relaxed text-ink">{d.body}</pre>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="gold">{d.tierPitch}</Chip>
          <Chip tone="dim">{d.angle}</Chip>
          <Chip tone="plum">refs: {d.refs.join(", ")}</Chip>
        </div>
        <Trace steps={d.trace} engine={d.engine} />
        <div className="flex flex-wrap gap-2 border-t border-plum-700/60 pt-4">
          <Btn onClick={() => {
            if (lead) window.open(gmailUrl(lead.email, d.subject, d.body), "_blank");
            toast("Gmail compose opened — you press send.", "teal");
          }}><Icon name="external" size={13} /> Open in Gmail compose</Btn>
          <Btn variant="outline" onClick={() => { navigator.clipboard?.writeText(`Subject: ${d.subject}\n\n${d.body}`).catch(() => {}); toast("Copied to clipboard."); }}><Icon name="copy" size={13} /> Copy</Btn>
          {d.status !== "sent" && (
            <Btn variant="teal" onClick={() => {
              updateDraft(d.id, { status: "sent" });
              if (lead) updateLead(lead.id, { status: "engaged", lastActivity: new Date().toISOString(), history: [...lead.history, { ts: new Date().toISOString(), note: "Email sent by Priya from Gmail handoff." }] });
              toast("Marked sent — stage moved to engaged.", "teal");
              onClose();
            }}><Icon name="check" size={13} /> I sent it</Btn>
          )}
          {d.status === "ready" && (
            <Btn variant="danger" onClick={() => {
              updateDraft(d.id, { status: "discarded" });
              toast("Draft discarded.", "rani");
              onClose();
            }}>Discard</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- add lead ---------- */

function AddLeadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (l: Lead) => void }) {
  const [f, setF] = useState({ planner: "", owner: "", city: "", eventsPerYear: "20", teamSize: "5", currentTools: "Spreadsheets", source: "Referral", email: "" });
  const set = (k: string, v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const input = "w-full rounded-lg border border-plum-600/70 bg-plum-950/70 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-gold-500/60";
  return (
    <Modal open={open} onClose={onClose} title="Feed the agent a lead">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-1 block"><span className="tick">planner name</span><input className={input} value={f.planner} onChange={(e) => set("planner", e.target.value)} placeholder="Naina Joshi" /></label>
        <label className="col-span-1 block"><span className="tick">firm</span><input className={input} value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Joshi Weddings" /></label>
        <label className="col-span-1 block"><span className="tick">city</span><input className={input} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Udaipur" /></label>
        <label className="col-span-1 block"><span className="tick">events / year</span><input className={input} type="number" value={f.eventsPerYear} onChange={(e) => set("eventsPerYear", e.target.value)} /></label>
        <label className="col-span-1 block"><span className="tick">team size</span><input className={input} type="number" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)} /></label>
        <label className="col-span-1 block"><span className="tick">tools today</span><input className={input} value={f.currentTools} onChange={(e) => set("currentTools", e.target.value)} placeholder="Meragi, Spreadsheets…" /></label>
        <label className="col-span-1 block"><span className="tick">source</span><input className={input} value={f.source} onChange={(e) => set("source", e.target.value)} placeholder="Referral — …" /></label>
        <label className="col-span-1 block"><span className="tick">email</span><input className={input} value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="naina@joshi.in" /></label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.planner || !f.city} onClick={async () => {
          const lead = await qualifyNewLead({ ...f, eventsPerYear: Number(f.eventsPerYear) || 10, teamSize: Number(f.teamSize) || 2 });
          onDone(lead);
          onClose();
        }}><Icon name="spark" size={13} /> Qualify with reasoning</Btn>
      </div>
    </Modal>
  );
}
