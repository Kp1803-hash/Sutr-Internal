import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/* ---------------- icons ---------------- */

const PATHS: Record<string, ReactNode> = {
  grid: (<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  send: (<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>),
  megaphone: (<><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>),
  pulse: (<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  vault: (<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="4.2" /><path d="M12 7.8V5.6M12 18.4v-2.2M7.8 12H5.6M18.4 12h-2.2" /></>),
  scroll: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" /></>),
  sliders: (<><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1.5 14h5M9.5 8h5M17.5 16h5" /></>),
  spark: (<path d="M12 2.5 14 9l6.5 3L14 15l-2 6.5L10 15l-6.5-3L10 9Z" />),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  alert: (<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>),
  search: (<><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.35-4.35" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  x: (<path d="M18 6 6 18M6 6l12 12" />),
  check: (<path d="M20 6 9 17l-5-5" />),
  external: (<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></>),
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  chevron: (<path d="m6 9 6 6 6-6" />),
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  refresh: (<><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>),
  shield: (<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  bolt: (<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />),
  tag: (<><path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><path d="M7 7h.01" /></>),
  users: (<><circle cx="9" cy="7" r="4" /><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  inbox: (<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  copy: (<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  arrow: (<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>),
  filter: (<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />),
  upload: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 8 5-5 5 5" /><path d="M12 3v12" /></>),
  wand: (<><path d="M15 4V2M15 10V8M11.5 6h2M18.5 6h2M17.5 8.5 19 10M3 21l9.5-9.5M12.5 6.5 14 5" /></>),
  key: (<><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8.8-8.8M15 5l2.5 2.5M18.5 8.5 21 11" /></>),
  thread: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2v6.8M12 15.2V22M2 12h6.8M15.2 12H22" /><path d="m4.9 4.9 4 4M15.1 15.1l4 4M19.1 4.9l-4 4M8.9 15.1l-4 4" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
};

export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name] ?? PATHS.spark}
    </svg>
  );
}

/* ---------------- primitives ---------------- */

export const AGENT_TONES: Record<string, { text: string; bg: string; dot: string }> = {
  sales: { text: "text-gold-300", bg: "bg-gold-500/10 border-gold-500/30", dot: "bg-gold-400" },
  marketing: { text: "text-rani-300", bg: "bg-rani-500/10 border-rani-500/30", dot: "bg-rani-400" },
  ops: { text: "text-teal-300", bg: "bg-teal-500/10 border-teal-500/30", dot: "bg-teal-400" },
  vault: { text: "text-plum-200", bg: "bg-plum-500/15 border-plum-400/30", dot: "bg-plum-300" },
  system: { text: "text-ink-dim", bg: "bg-plum-800/40 border-plum-600/30", dot: "bg-ink-faint" },
};

export function Chip({ tone = "gold", children, className = "" }: { tone?: string; children: ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    gold: "text-gold-300 border-gold-500/35 bg-gold-500/10",
    rani: "text-rani-300 border-rani-500/35 bg-rani-500/10",
    teal: "text-teal-300 border-teal-500/35 bg-teal-500/10",
    plum: "text-plum-200 border-plum-400/35 bg-plum-500/15",
    dim: "text-ink-faint border-plum-600/40 bg-plum-800/40",
    danger: "text-rani-300 border-rani-500/50 bg-rani-500/15",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tones[tone] ?? tones.gold} ${className}`}>
      {children}
    </span>
  );
}

export function Btn({
  variant = "gold", size = "md", onClick, children, disabled, className = "", title,
}: {
  variant?: "gold" | "ghost" | "outline" | "rani" | "teal" | "danger";
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const variants: Record<string, string> = {
    gold: "bg-gold-500 text-plum-950 hover:bg-gold-400 font-bold shadow-[0_4px_18px_-6px_rgba(212,162,78,0.5)]",
    ghost: "text-ink-dim hover:text-gold-300 hover:bg-plum-800/60",
    outline: "border border-gold-500/40 text-gold-300 hover:bg-gold-500/10",
    rani: "bg-rani-500 text-plum-950 hover:bg-rani-400 font-bold",
    teal: "bg-teal-500 text-plum-950 hover:bg-teal-400 font-bold",
    danger: "border border-rani-500/50 text-rani-300 hover:bg-rani-500/15",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-plum-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`rv-scale relative max-h-[88vh] w-full overflow-y-auto rounded-xl border border-gold-500/25 bg-plum-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-plum-700/60 bg-plum-900/95 px-5 py-3.5 backdrop-blur">
          <div className="font-display text-lg text-gold-200">{title}</div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-plum-800 hover:text-gold-300" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Bar({ value, max, tone = "gold" }: { value: number; max: number; tone?: string }) {
  const tones: Record<string, string> = {
    gold: "bg-gold-400", rani: "bg-rani-400", teal: "bg-teal-400", plum: "bg-plum-400",
  };
  const pct = Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-plum-800">
      <div className={`h-full rounded-full ${tones[tone] ?? tones.gold} transition-all duration-700`} style={{ width: pct + "%" }} />
    </div>
  );
}

export function Trace({ steps, engine }: { steps: string[]; engine?: string }) {
  if (!steps?.length) return null;
  return (
    <div className="rounded-lg border border-plum-700/70 bg-plum-950/60 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="tick flex items-center gap-1.5"><Icon name="bolt" size={11} /> reasoning trail</span>
        {engine && <Chip tone={engine === "ondevice" ? "teal" : "gold"}>{engine === "ondevice" ? "on-device" : engine}</Chip>}
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-dim">
            <span className="mt-0.5 font-mono text-[10px] text-gold-500">{String(i + 1).padStart(2, "0")}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SevBadge({ level }: { level: 1 | 2 | 3 }) {
  const map = {
    1: { label: "SEV 1 · WATCH", cls: "text-plum-200 border-plum-400/40 bg-plum-500/10" },
    2: { label: "SEV 2 · SLA", cls: "text-saffron-300 border-saffron-400/40 bg-saffron-500/10" },
    3: { label: "SEV 3 · ESCALATED", cls: "text-rani-300 border-rani-500/50 bg-rani-500/15" },
  }[level];
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${map.cls}`}>{map.label}</span>;
}

/* ---------------- signature thread artwork ---------------- */

export function ThreadArt({ className = "" }: { className?: string }) {
  const paths = [
    { d: "M0 62 C 90 20, 180 84, 300 44 S 500 12, 620 50", c: "#d4a24e", o: 0.9, w: 1.6 },
    { d: "M0 30 C 120 70, 220 10, 340 52 S 520 78, 620 26", c: "#d94f8c", o: 0.55, w: 1.1 },
    { d: "M0 46 C 150 8, 260 70, 380 30 S 540 40, 620 62", c: "#4cc4b1", o: 0.5, w: 1.1 },
    { d: "M0 74 C 100 52, 240 24, 360 62 S 500 56, 620 14", c: "#c39bd8", o: 0.35, w: 0.9 },
  ];
  return (
    <svg viewBox="0 0 620 84" preserveAspectRatio="none" className={className} aria-hidden>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={p.c} strokeOpacity={p.o} strokeWidth={p.w}
          pathLength={1} className="thread-path" style={{ animationDelay: `${0.15 + i * 0.22}s` }} />
      ))}
      {[{ x: 148, y: 42 }, { x: 332, y: 46 }, { x: 512, y: 38 }].map((k, i) => (
        <circle key={i} cx={k.x} cy={k.y} r="2.6" fill="#d4a24e" opacity={0.9} className="pulse-dot" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
    </svg>
  );
}

/* ---------------- agent thinking (staged feedback) ---------------- */

export function Thinking({ stages, stage }: { stages: string[]; stage: number }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-gold-500/20 bg-plum-950/60 p-3">
      {stages.map((s, i) => (
        <div key={i} className={`flex items-center gap-2 font-mono text-[11px] transition-all duration-300 ${i < stage ? "text-gold-300" : i === stage ? "text-ink" : "text-ink-faint/40"}`}>
          {i < stage ? <Icon name="check" size={11} /> : i === stage ? <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold-400" /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-plum-600" />}
          {s}
        </div>
      ))}
      <div className="thinking-bar mt-1 h-0.5 w-full rounded-full" />
    </div>
  );
}

export function useStagedRun(stages: string[], run: () => Promise<void>) {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const trigger = async () => {
    if (running) return;
    setRunning(true);
    setStage(0);
    const per = Math.max(260, 1100 / stages.length);
    for (let i = 0; i < stages.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, per));
    }
    try {
      await run();
    } finally {
      setRunning(false);
      setStage(0);
    }
  };
  return { running, stage, trigger };
}

/* ---------------- toasts ---------------- */

type Toast = { id: number; msg: string; tone: "gold" | "rani" | "teal" };
let pushToast: ((t: Toast) => void) | null = null;
let toastId = 0;

export function toast(msg: string, tone: Toast["tone"] = "gold") {
  pushToast?.({ id: ++toastId, msg, tone });
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      setToasts((cur) => [...cur.slice(-3), t]);
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 4600);
    };
    return () => { pushToast = null; };
  }, []);
  const tones = { gold: "border-gold-500/50 text-gold-200", rani: "border-rani-500/50 text-rani-300", teal: "border-teal-500/50 text-teal-300" };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rv-slide pointer-events-auto rounded-lg border bg-plum-900/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur ${tones[t.tone]}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
