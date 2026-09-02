import { useEffect, useState } from "react";
import { useApp, getState, todayKey } from "./lib/store";
import { generateMorningDigest, runOpsScan } from "./lib/agents";
import { engineLabel, hasLiveEngine } from "./lib/llm";
import { Icon, ToastHost, toast, Chip } from "./components/ui";
import Dashboard from "./components/Dashboard";
import SalesView from "./components/SalesView";
import MarketingView from "./components/MarketingView";
import OpsView from "./components/OpsView";
import VaultView from "./components/VaultView";
import { ActivityView, SettingsView } from "./components/SystemViews";

const VIEWS = [
  { id: "dashboard", label: "Command deck", icon: "grid" },
  { id: "sales", label: "Sales agent", icon: "send" },
  { id: "marketing", label: "Marketing agent", icon: "megaphone" },
  { id: "ops", label: "Operations agent", icon: "pulse" },
  { id: "vault", label: "Document vault", icon: "vault" },
  { id: "activity", label: "Activity log", icon: "scroll" },
  { id: "settings", label: "Engine & guardrails", icon: "sliders" },
];

export default function App() {
  const s = useApp();
  const [view, setView] = useState("dashboard");
  const [digestBusy, setDigestBusy] = useState(false);
  const [clock, setClock] = useState(new Date());

  /* 06:00 trigger — on first load after 6 AM, compile the morning digest */
  useEffect(() => {
    const st = getState();
    const hour = new Date().getHours();
    const needDigest = !st.digest || st.digest.date !== todayKey();
    if (hour >= 6 && needDigest) {
      setDigestBusy(true);
      generateMorningDigest()
        .then((d) => {
          if (d.opsSummary.escalated > 0)
            toast(`Overnight: Ops escalated ${d.opsSummary.escalated} severity-3 risk — leading the dashboard.`, "rani");
          else toast("Morning brief compiled — ideas, sales queue and ops alerts bundled.", "teal");
        })
        .finally(() => setDigestBusy(false));
    } else {
      const stale = !st.lastOpsScan || Date.now() - new Date(st.lastOpsScan).getTime() > 12 * 3600000;
      if (stale) runOpsScan();
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const readyDrafts = s.drafts.filter((d) => d.status === "ready").length;
  const openRisks = s.risks.filter((r) => r.status !== "resolved").length;
  const escalated = s.risks.filter((r) => r.status === "escalated").length;
  const expiring = s.documents.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() - Date.now() < 30 * 86400000).length;
  const todayIdeas = s.ideas.filter((i) => i.date === todayKey() && i.status !== "dismissed").length;

  const badges: Record<string, { n: number; tone: string } | undefined> = {
    sales: readyDrafts ? { n: readyDrafts, tone: "bg-gold-500 text-plum-950" } : undefined,
    ops: openRisks ? { n: openRisks, tone: escalated ? "bg-rani-500 text-plum-950" : "bg-saffron-400 text-plum-950" } : undefined,
    vault: expiring ? { n: expiring, tone: "bg-saffron-400 text-plum-950" } : undefined,
    marketing: todayIdeas ? { n: todayIdeas, tone: "bg-rani-500 text-plum-950" } : undefined,
  };

  const live = hasLiveEngine();

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* ambient layers */}
      <div className="ambient-orb drift-glow left-[-120px] top-[-100px] h-[420px] w-[420px] bg-gold-500/[0.07]" />
      <div className="ambient-orb bottom-[-140px] right-[-80px] h-[460px] w-[460px] bg-plum-500/20" style={{ animationDelay: "4s" }} />

      {/* sidebar */}
      <aside className="relative z-10 flex w-16 shrink-0 flex-col border-r border-gold-500/10 bg-plum-900/80 backdrop-blur lg:w-60">
        <div className="flex items-center gap-2.5 border-b border-plum-700/50 px-3 py-4 lg:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/40 bg-gold-500/10 text-gold-400">
            <Icon name="thread" size={19} />
          </span>
          <div className="hidden lg:block">
            <div className="font-display text-xl font-bold leading-none text-ink">Sutr</div>
            <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold-500">every thread, connected</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3">
          {VIEWS.map((v) => {
            const active = view === v.id;
            const badge = badges[v.id];
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-all duration-200 lg:px-3 ${active ? "bg-gold-500/15 text-gold-200 shadow-[inset_2px_0_0_#d4a24e]" : "text-ink-faint hover:bg-plum-800/70 hover:text-ink"}`}>
                <Icon name={v.icon} size={17} className={`shrink-0 transition-colors ${active ? "text-gold-300" : "group-hover:text-gold-400"}`} />
                <span className="hidden flex-1 text-[13px] font-semibold lg:block">{v.label}</span>
                {badge && <span className={`hidden h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold lg:flex ${badge.tone}`} style={{ height: 18 }}>{badge.n}</span>}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-plum-700/50 p-4 lg:block">
          <div className="space-y-1 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            <div className="flex items-center gap-1.5"><Icon name="shield" size={9} className="text-gold-500" /> no auto-send</div>
            <div className="flex items-center gap-1.5"><Icon name="shield" size={9} className="text-gold-500" /> no auto-spend</div>
            <div className="flex items-center gap-1.5"><Icon name="shield" size={9} className="text-gold-500" /> no fabricated data</div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="flex items-center gap-3 border-b border-gold-500/10 bg-plum-950/70 px-4 py-3 backdrop-blur lg:px-6">
          <span className="tick hidden md:block">orchestrator · 4 agents · shared context store</span>
          <div className="ml-auto flex items-center gap-2">
            <Chip tone={live ? "gold" : "teal"}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "pulse-dot bg-gold-400" : "bg-teal-400"}`} />
              {engineLabel()}
            </Chip>
            <Chip tone="dim" className="hidden sm:inline-flex"><Icon name="clock" size={10} /> {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Chip>
            <span className="hidden items-center gap-2 rounded-full border border-plum-600 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/20 font-display text-xs font-bold text-gold-300">{s.ownerName[0]}</span>
              <span className="text-xs font-semibold text-ink">{s.ownerName}</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div key={view} className="mx-auto max-w-6xl">
            {view === "dashboard" && <Dashboard go={setView} digestBusy={digestBusy} />}
            {view === "sales" && <SalesView />}
            {view === "marketing" && <MarketingView />}
            {view === "ops" && <OpsView />}
            {view === "vault" && <VaultView />}
            {view === "activity" && <ActivityView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
