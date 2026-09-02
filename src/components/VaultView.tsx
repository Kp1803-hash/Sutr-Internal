import { useMemo, useState } from "react";
import { useApp, fmtDate } from "../lib/store";
import type { Doc } from "../lib/store";
import { searchDocs, expiryWatch, ingestDocument } from "../lib/agents";
import { Btn, Chip, Icon, Modal, Trace, toast, useStagedRun, Thinking } from "./ui";

export default function VaultView() {
  const s = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<Doc | null>(null);
  const [traceFor, setTraceFor] = useState<{ title: string; steps: string[] } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const expiring = expiryWatch();
  const results = useMemo(() => (q.trim() ? searchDocs(q) : s.documents.map((doc) => ({ doc, hits: [] as string[] }))), [q, s.documents]);

  const filtered = results.filter(({ doc }) => {
    if (filter === "all") return true;
    if (filter === "expiring") return expiring.some((e) => e.doc.id === doc.id);
    if (filter === "ocr") return doc.ocr;
    return doc.type === filter;
  });

  const types = [...new Set(s.documents.map((d) => d.type))];

  return (
    <div className="space-y-5">
      <header className="rv flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tick mb-1">agent 04 · document vault · sutr</div>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Single source of truth</h1>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="dim"><Icon name="lock" size={10} /> owner-only access — guardrail 5</Chip>
          <Btn onClick={() => setAddOpen(true)}><Icon name="upload" size={13} /> Ingest document</Btn>
        </div>
      </header>

      {/* natural-language retrieval */}
      <section className="rv panel p-5" style={{ animationDelay: "0.06s" }}>
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder='Ask in plain words — "vendor agreement nearing renewal", "the pitch deck", "meragi comparison research"…'
            className="w-full rounded-xl border border-gold-500/25 bg-plum-950/70 py-3.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-gold-500/60"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["all", "expiring", "ocr", ...types].map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all ${filter === t ? "border-gold-400 bg-gold-500/20 text-gold-200" : "border-plum-600 text-ink-faint hover:border-gold-500/50 hover:text-gold-300"}`}>
              {t === "expiring" ? `expiring ≤30d (${expiring.length})` : t === "ocr" ? "ocr scans" : t}
            </button>
          ))}
        </div>
        {q.trim() && (
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {filtered.length} match{filtered.length === 1 ? "" : "es"} · query expanded with vault synonyms · ranked by field weight
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* document list */}
        <section className="space-y-2.5 lg:col-span-2">
          {filtered.length === 0 && (
            <div className="rv panel p-8 text-center text-xs text-ink-faint">Nothing matches — the vault only retrieves what's actually stored. No fabricated hits.</div>
          )}
          {filtered.map(({ doc, hits }, i) => {
            const days = doc.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={doc.id} className="rv panel panel-hover flex items-center gap-3 px-4 py-3.5" style={{ animationDelay: `${0.08 + Math.min(i * 0.04, 0.4)}s` }}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${doc.ocr ? "border-teal-500/40 text-teal-300" : "border-gold-500/30 text-gold-400"}`}>
                  <Icon name={doc.type === "Contract" ? "scroll" : doc.type === "Deck" ? "spark" : doc.type === "Brand" ? "tag" : "scroll"} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{doc.title}</span>
                    {doc.ocr && <Chip tone="teal">ocr</Chip>}
                    {days !== null && days <= 30 && (
                      <Chip tone={days <= 10 ? "danger" : "gold"}><Icon name="calendar" size={9} /> {days}d</Chip>
                    )}
                    <Chip tone="dim"><Icon name="lock" size={9} /> owner</Chip>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
                    <Chip tone="plum">{doc.type}</Chip>
                    <span>{doc.relatedTo}</span>
                    <span>· added {fmtDate(doc.addedAt)}</span>
                    {hits.length > 0 && <span className="text-gold-400">matched: {hits.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Btn size="sm" variant="ghost" title="Why these tags?" onClick={() => setTraceFor({ title: doc.title, steps: doc.trace })}><Icon name="bolt" size={12} /></Btn>
                  <Btn size="sm" variant="outline" onClick={() => setView(doc)}><Icon name="eye" size={12} /> Open</Btn>
                </div>
              </div>
            );
          })}
        </section>

        {/* expiry watch + stats */}
        <div className="space-y-5">
          <section className="rv panel p-5" style={{ animationDelay: "0.14s" }}>
            <h2 className="mb-3 font-display text-lg text-gold-200">Expiry watch</h2>
            {expiring.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing inside the 30-day renewal window.</p>
            ) : (
              <div className="space-y-2">
                {expiring.map(({ doc, days }) => (
                  <button key={doc.id} onClick={() => setView(doc)} className="w-full rounded-lg border border-saffron-400/30 bg-saffron-500/5 p-3 text-left transition-colors hover:bg-saffron-500/10">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-semibold text-ink">{doc.title}</span>
                      <span className={`font-mono text-[11px] ${days <= 10 ? "text-rani-300" : "text-saffron-300"}`}>{days}d</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-faint">{doc.relatedTo} · renewal conversation due</div>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="rv panel p-5" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 font-display text-lg text-gold-200">Vault ledger</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "documents", v: s.documents.length },
                { l: "ocr searchable", v: s.documents.filter((d) => d.ocr).length },
                { l: "contracts", v: s.documents.filter((d) => d.type === "Contract").length },
                { l: "tag families", v: types.length },
              ].map((x, i) => (
                <div key={i} className="rounded-lg border border-plum-700/60 bg-plum-950/40 p-3">
                  <div className="font-display text-2xl font-bold text-gold-300">{x.v}</div>
                  <div className="tick mt-0.5">{x.l}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">Other agents read from here daily — Sales borrows the competitive research, Ops cites the SLA doc, Marketing checks the brand voice. One vault, every thread.</p>
          </section>
        </div>
      </div>

      {/* document viewer */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title ?? ""} wide>
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="plum">{view.type}</Chip>
              {view.tags.map((t) => <Chip key={t} tone="dim">{t}</Chip>)}
              {view.ocr && <Chip tone="teal">ocr extracted</Chip>}
              <Chip tone="dim"><Icon name="lock" size={9} /> owner-only</Chip>
            </div>
            <div className="rounded-lg border border-plum-700/70 bg-plum-950/70 p-4">
              <div className="tick mb-2">full text — searchable</div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-dim">{view.content}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-ink-faint">
              <div>Related to: <span className="text-ink-dim">{view.relatedTo}</span></div>
              <div>Added: <span className="text-ink-dim">{fmtDate(view.addedAt)}</span>{view.expiresAt && <> · expires <span className="text-saffron-300">{fmtDate(view.expiresAt)}</span></>}</div>
            </div>
            <Trace steps={view.trace} engine="ondevice" />
          </div>
        )}
      </Modal>

      <Modal open={!!traceFor} onClose={() => setTraceFor(null)} title="How this was tagged">
        {traceFor && <div className="space-y-3"><p className="text-sm text-ink-dim">{traceFor.title}</p><Trace steps={traceFor.steps} engine="ondevice" /></div>}
      </Modal>

      <AddDocModal open={addOpen} onClose={() => setAddOpen(false)} onIngested={(d) => setTraceFor({ title: d.title, steps: d.trace })} />
    </div>
  );
}

function AddDocModal({ open, onClose, onIngested }: { open: boolean; onClose: () => void; onIngested: (d: Doc) => void }) {
  const [f, setF] = useState({ title: "", type: "", relatedTo: "Internal", content: "", expiresAt: "", ocr: false });
  const input = "w-full rounded-lg border border-plum-600/70 bg-plum-950/70 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-gold-500/60";
  const ingest = useStagedRun(
    ["reading title + full text", "detecting type, entities, renewal language", "auto-tagging + linking to planner register", "filing with access: owner-only"],
    async () => {
      const doc = await ingestDocument(f);
      toast(`"${doc.title}" filed as ${doc.type} · tags [${doc.tags.join(", ")}]`, "teal");
      onIngested(doc);
      onClose();
      setF({ title: "", type: "", relatedTo: "Internal", content: "", expiresAt: "", ocr: false });
    }
  );
  return (
    <Modal open={open} onClose={onClose} title="Ingest into the vault">
      {ingest.running ? (
        <Thinking stages={["reading title + full text", "detecting type, entities, renewal language", "auto-tagging + linking to planner register", "filing with access: owner-only"]} stage={ingest.stage} />
      ) : (
        <div className="space-y-3">
          <label className="block"><span className="tick">title</span><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Vendor Agreement — Sangeet Squad" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="tick">type (blank = auto-detect)</span>
              <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                <option value="">auto-detect</option>
                {["Contract", "Deck", "Spec", "Brand", "Research", "Ops doc", "Investor", "Finance", "Playbook", "Partnership"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block"><span className="tick">related planner / deal</span><input className={input} value={f.relatedTo} onChange={(e) => setF({ ...f, relatedTo: e.target.value })} /></label>
          </div>
          <label className="block"><span className="tick">expiry date (optional)</span><input type="date" className={input} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></label>
          <label className="block"><span className="tick">content / extracted text</span>
            <textarea rows={5} className={input} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Paste the agreement text, research notes, or scan transcript…" />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-dim">
            <input type="checkbox" checked={f.ocr} onChange={(e) => setF({ ...f, ocr: e.target.checked })} className="accent-gold-500" />
            This is a scan — run the OCR pass (simulated) so it's searchable
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn disabled={!f.title || !f.content} onClick={ingest.trigger}><Icon name="vault" size={13} /> Ingest + auto-tag</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
