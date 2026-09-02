import { useSyncExternalStore } from "react";

/* ============================================================
   SUTR SHARED CONTEXT STORE — the orchestrator layer.
   Every agent reads from and writes to this one store, so a
   churn flag in Ops can restrain a pitch in Sales, and Marketing
   sees the segments Sales actually converts.
   ============================================================ */

export type Engine = "claude" | "openai" | "ondevice";
export type Stage = "new" | "qualified" | "drafted" | "engaged" | "nurture" | "won" | "lost";
export type AgentName = "sales" | "marketing" | "ops" | "vault" | "system";

export interface Lead {
  id: string;
  planner: string;
  owner: string;
  city: string;
  eventsPerYear: number;
  teamSize: number;
  currentTools: string[];
  source: string;
  status: Stage;
  tierFit: string;
  fitScore: number;
  email: string;
  notes: string[];
  lastActivity: string;
  history: { ts: string; note: string }[];
}

export interface PlannerAccount {
  id: string;
  name: string;
  city: string;
  tier: string;
  onboardedAt: string;
  setupPct: number;
  lastActiveDays: number;
  openTickets: number;
  activeEvents: number;
  vendorConfirmGap?: { event: string; confirmed: number; total: number; daysOut: number };
  signals: string[];
  linkedLeadId?: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: "LinkedIn" | "Instagram" | "WhatsApp" | "Community" | "SEO";
  goal: string;
  audience: string;
  status: "live" | "proposed" | "paused";
  startDate: string;
  metrics: { impressions: number; clicks: number; replies: number; leads: number };
  proposedBudget: number;
}

export interface OpsRisk {
  id: string;
  severity: 1 | 2 | 3;
  title: string;
  category: string;
  entity: string;
  entityId: string;
  evidence: string[];
  why: string;
  recommendation: string;
  status: "open" | "escalated" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  trace: string[];
  refs: string[];
  engine: Engine;
}

export interface Doc {
  id: string;
  title: string;
  type: string;
  tags: string[];
  relatedTo: string;
  addedAt: string;
  expiresAt?: string;
  summary: string;
  content: string;
  ocr: boolean;
  access: "owner";
  trace: string[];
}

export interface Draft {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  angle: string;
  tierPitch: string;
  status: "ready" | "opened" | "sent" | "discarded";
  createdAt: string;
  trace: string[];
  refs: string[];
  engine: Engine;
}

export interface Brief {
  objective: string;
  audience: string;
  channel: string;
  message: string;
  format: string;
  proposedBudget: string;
  kpi: string;
  voice: string;
  timeline: string;
}

export interface Idea {
  id: string;
  title: string;
  rationale: string;
  channel: string;
  seasonality: string;
  groundedIn: string[];
  costEstimate: string;
  status: "proposed" | "briefed" | "dismissed";
  date: string;
  brief?: Brief;
  trace: string[];
  engine: Engine;
}

export interface ActivityEntry {
  id: string;
  ts: string;
  agent: AgentName;
  action: string;
  summary: string;
  trace: string[];
  refs: string[];
  engine: Engine;
}

export interface Digest {
  date: string;
  generatedAt: string;
  engine: Engine;
  ideaIds: string[];
  salesSummary: { draftsReady: number; repliesNew: number; topLeadId: string | null; topLeadNote: string };
  opsSummary: { openRisks: number; escalated: number; topRiskId: string | null; note: string };
}

export interface AppState {
  ownerName: string;
  leads: Lead[];
  accounts: PlannerAccount[];
  campaigns: Campaign[];
  risks: OpsRisk[];
  documents: Doc[];
  drafts: Draft[];
  ideas: Idea[];
  activity: ActivityEntry[];
  digest: Digest | null;
  lastOpsScan: string | null;
  seedVersion: number;
}

/* ---------------- utilities ---------------- */

export const TIERS = [
  { name: "Starter", price: 9000 },
  { name: "Studio", price: 14000 },
  { name: "Growth", price: 24000 },
  { name: "Scale", price: 40000 },
];

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

export const fmtINR = (n: number) => "₹" + n.toLocaleString("en-IN");
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
export const todayKey = () => new Date().toISOString().slice(0, 10);

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const daysAgoISO = (n: number, hourOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hourOffset);
  return d.toISOString();
};
const daysFromNowISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

/* ---------------- seed data ---------------- */

const SEED_VERSION = 3;

function seedState(): AppState {
  return {
    ownerName: "Priya",
    seedVersion: SEED_VERSION,
    leads: [
      {
        id: "lead-01", planner: "Aisha Verma", owner: "Verma Vogue Weddings", city: "Jaipur",
        eventsPerYear: 62, teamSize: 14, currentTools: ["Spreadsheets", "WhatsApp"],
        source: "Referral — Ritika Malhotra (customer)", status: "new", tierFit: "Scale", fitScore: 91,
        email: "aisha@vermavogue.in",
        notes: ["Ritika's highest-trusted peer. Runs 4+ concurrent destination weddings in peak season.", "Currently coordinating vendors on 6 Google Sheets — she told Ritika she loses weekends to it."],
        lastActivity: daysAgoISO(1), history: [{ ts: daysAgoISO(1), note: "Referral received from Ritika Malhotra (acc-02). Warm intro offered." }],
      },
      {
        id: "lead-02", planner: "Kabir Sethi", owner: "Sethi & Co. Celebrations", city: "Delhi NCR",
        eventsPerYear: 41, teamSize: 9, currentTools: ["Meragi"], source: "Instagram DM", status: "qualified", tierFit: "Growth", fitScore: 84,
        email: "kabir@sethico.events",
        notes: ["Unhappy with Meragi billing module — 'invoices go out late, clients notice'.", "Asked whether Sutr handles multi-city vendor payouts."],
        lastActivity: daysAgoISO(0, 5), history: [
          { ts: daysAgoISO(6), note: "Replied to Instagram outreach. Booked 15-min call." },
          { ts: daysAgoISO(3), note: "Call done. Pricing one-pager sent. Wants a draft to circulate to his ops lead." },
        ],
      },
      {
        id: "lead-03", planner: "Meera Krishnan", owner: "Kalyana Weddings", city: "Kochi",
        eventsPerYear: 12, teamSize: 3, currentTools: ["Nothing yet"], source: "IWPFA directory", status: "new", tierFit: "Starter", fitScore: 63,
        email: "meera@kalyanaweddings.com",
        notes: ["Boutique — 2–3 weddings a month, temple + church ceremonies, strong family repeat business."],
        lastActivity: daysAgoISO(4), history: [{ ts: daysAgoISO(4), note: "Sourced from IWPFA Kerala chapter directory." }],
      },
      {
        id: "lead-04", planner: "Devanshi Shah", owner: "DS Luxe Events", city: "Mumbai",
        eventsPerYear: 28, teamSize: 7, currentTools: ["WedMeGood listing", "Spreadsheets"], source: "LinkedIn", status: "drafted", tierFit: "Studio", fitScore: 72,
        email: "devanshi@dsluxe.in",
        notes: ["Gets 40% of enquiries via WedMeGood listing — won't abandon it. Sutr must complement, not replace."],
        lastActivity: daysAgoISO(2), history: [
          { ts: daysAgoISO(5), note: "Connected on LinkedIn, engaged with founder story post." },
          { ts: daysAgoISO(2), note: "First outreach draft created. Waiting in send queue." },
        ],
      },
      {
        id: "lead-05", planner: "Rituraj Singh", owner: "Pink City Productions", city: "Jaipur",
        eventsPerYear: 85, teamSize: 22, currentTools: ["Meragi"], source: "Planner association referral", status: "qualified", tierFit: "Scale", fitScore: 88,
        email: "rituraj@pinkcityproductions.com",
        notes: ["High-volume Meragi power user. Contractually mid-term — switch window opens after Feb peak season.", "Pain: Meragi timeline view doesn't survive 80+ concurrent events."],
        lastActivity: daysAgoISO(7), history: [
          { ts: daysAgoISO(12), note: "Intro via association. Expressed frustration with Meragi at scale." },
          { ts: daysAgoISO(7), note: "Sent case study: Ritika Malhotra's 92% setup in 9 days." },
        ],
      },
      {
        id: "lead-06", planner: "Sana Qureshi", owner: "Nikah & Nectar", city: "Hyderabad",
        eventsPerYear: 9, teamSize: 2, currentTools: ["Nothing yet"], source: "Instagram", status: "nurture", tierFit: "Starter", fitScore: 55,
        email: "sana@nikahnectar.in",
        notes: ["First-year planner. Enthusiastic but pre-revenue consistency. Nurture via WhatsApp broadcast until she crosses 12 events."],
        lastActivity: daysAgoISO(11), history: [{ ts: daysAgoISO(11), note: "Added to WhatsApp warm nurture list (#4)." }],
      },
      {
        id: "lead-07", planner: "Ankit Bansal", owner: "Bansal Banquets & Events", city: "Chandigarh",
        eventsPerYear: 22, teamSize: 6, currentTools: ["Nothing yet"], source: "Referral — cousin is a customer", status: "new", tierFit: "Studio", fitScore: 76,
        email: "ankit@bansalevents.co",
        notes: ["Replied to cousin's forward asking 'what does it cost per wedding?' — price-first buyer, lead with Starter→Studio math."],
        lastActivity: daysAgoISO(0, 9), history: [{ ts: daysAgoISO(0, 9), note: "Inbound reply: 'what does it cost per wedding?'" }],
      },
      {
        id: "lead-08", planner: "Zoya Fernandes", owner: "Susegad Weddings", city: "Goa",
        eventsPerYear: 18, teamSize: 5, currentTools: ["Spreadsheets"], source: "Inbound — comparison research", status: "new", tierFit: "Studio", fitScore: 69,
        email: "zoya@susegadweddings.com",
        notes: ["Downloaded our Meragi-vs-Sutr comparison page. Destination specialist — vendor travel logistics is her bottleneck."],
        lastActivity: daysAgoISO(2), history: [{ ts: daysAgoISO(2), note: "Inbound via comparison SEO campaign (cam-05)." }],
      },
      {
        id: "lead-09", planner: "Harpreet Kaur", owner: "Anand Karaj Events", city: "Amritsar",
        eventsPerYear: 15, teamSize: 4, currentTools: ["Nothing yet"], source: "IWPFA directory", status: "nurture", tierFit: "Starter", fitScore: 58,
        email: "harpreet@anandkaraj.in",
        notes: ["Replied: 'call me after wedding season' — re-engage in first week of March."],
        lastActivity: daysAgoISO(16), history: [{ ts: daysAgoISO(16), note: "Asked to reconnect post-season. Nurture until March." }],
      },
      {
        id: "lead-10", planner: "Nikhil Chopra", owner: "Vivah Crafters", city: "Jaipur",
        eventsPerYear: 30, teamSize: 8, currentTools: ["Sutr (Starter customer)"],
        source: "Existing customer — upgrade candidate", status: "engaged", tierFit: "Growth", fitScore: 74,
        email: "nikhil@vivahcrafters.in",
        notes: ["Already a Starter customer (acc-01). Upgrade pitch was planned — BUT his onboarding is stalling. Pitching now would backfire."],
        lastActivity: daysAgoISO(6), history: [
          { ts: daysAgoISO(21), note: "Converted to Starter after Jaipur IWPFA meetup." },
          { ts: daysAgoISO(6), note: "Upgrade conversation started. Ops flagged onboarding stall — HOLD pitch." },
        ],
      },
    ],
    accounts: [
      {
        id: "acc-01", name: "Vivah Crafters", city: "Jaipur", tier: "Starter",
        onboardedAt: daysAgoISO(21), setupPct: 45, lastActiveDays: 6, openTickets: 2, activeEvents: 1,
        signals: ["Setup stalled at 45% for 9 days", "Vendor-sync tickets open 5 days", "Matches churn pattern from Q3 postmortem"],
        linkedLeadId: "lead-10",
      },
      {
        id: "acc-02", name: "Ritika Malhotra Events", city: "Mumbai", tier: "Growth",
        onboardedAt: daysAgoISO(140), setupPct: 92, lastActiveDays: 0, openTickets: 0, activeEvents: 3,
        signals: ["Healthiest account", "Referred Aisha Verma last week"],
      },
      {
        id: "acc-03", name: "Utsav Collective", city: "Bengaluru", tier: "Studio",
        onboardedAt: daysAgoISO(60), setupPct: 78, lastActiveDays: 2, openTickets: 1, activeEvents: 2,
        vendorConfirmGap: { event: "Sharma Sangeet — 28 Nov", confirmed: 7, total: 12, daysOut: 19 },
        signals: ["5 of 12 vendors unconfirmed with 19 days out", "SLA target is full confirmation at 21 days"],
      },
      {
        id: "acc-04", name: "Mehendi & Co", city: "Lucknow", tier: "Starter",
        onboardedAt: daysAgoISO(34), setupPct: 66, lastActiveDays: 12, openTickets: 0, activeEvents: 1,
        signals: ["Inactive 12 days with an event next month", "No event timeline created yet"],
      },
      {
        id: "acc-05", name: "Sangeet Squad", city: "Pune", tier: "Studio",
        onboardedAt: daysAgoISO(12), setupPct: 61, lastActiveDays: 1, openTickets: 0, activeEvents: 1,
        signals: ["On track — ahead of typical day-12 setup curve"],
      },
    ],
    campaigns: [
      {
        id: "cam-01", name: "Founder Story Series", channel: "LinkedIn",
        goal: "Planner awareness among 20+ event firms", audience: "Founder-planners, metros + Jaipur/Udaipur",
        status: "live", startDate: daysAgoISO(21),
        metrics: { impressions: 18400, clicks: 534, replies: 31, leads: 6 },
        proposedBudget: 8000,
      },
      {
        id: "cam-02", name: "Sangeet BTS Reels", channel: "Instagram",
        goal: "Planner awareness", audience: "Unspecified — algorithm served couples",
        status: "live", startDate: daysAgoISO(14),
        metrics: { impressions: 42100, clicks: 337, replies: 4, leads: 2 },
        proposedBudget: 12000,
      },
      {
        id: "cam-03", name: "WhatsApp Warm Nurture #4", channel: "WhatsApp",
        goal: "Convert warm leads pre-peak-season", audience: "140 warm leads from directory + events",
        status: "live", startDate: daysAgoISO(6),
        metrics: { impressions: 140, clicks: 85, replies: 12, leads: 3 },
        proposedBudget: 0,
      },
      {
        id: "cam-04", name: "IWPFA Jaipur Meetup Partnership", channel: "Community",
        goal: "High-trust referrals in Rajasthan corridor", audience: "IWPFA Jaipur chapter — 60 planners",
        status: "proposed", startDate: daysFromNowISO(11),
        metrics: { impressions: 0, clicks: 0, replies: 0, leads: 0 },
        proposedBudget: 15000,
      },
      {
        id: "cam-05", name: "Meragi-comparison SEO page", channel: "SEO",
        goal: "Capture planners actively comparing tools", audience: "Searchers: 'meragi alternative', 'wedding planner software india'",
        status: "live", startDate: daysAgoISO(28),
        metrics: { impressions: 1120, clicks: 49, replies: 3, leads: 1 },
        proposedBudget: 5000,
      },
    ],
    risks: [
      {
        id: "risk-01", severity: 2, title: "Vendor confirmation lag — Sharma Sangeet", category: "Event timeline",
        entity: "Utsav Collective", entityId: "acc-03",
        evidence: ["7 of 12 vendors confirmed, event in 19 days", "Platform SLA: full confirmation at 21 days out", "Caterer + décor (largest line items) both pending"],
        why: "Utsav is 2 days past the confirmation SLA with the two highest-value vendors still pending. Historically, décor vendors in Bengaluru need 3 weeks' notice for mandap builds.",
        recommendation: "Send Utsav the vendor-chase playbook (Onboarding Playbook v3, §4) and offer a Sutr-side nudge template to the caterer today.",
        status: "open", createdAt: daysAgoISO(0, 7),
        trace: ["Pulled acc-03 event timeline: 7/12 confirmed, 19 days out.", "Compared to SLA in doc-12 (21-day full-confirmation target) — 2 days overdue.", "Caterer and décor are 61% of event budget (from account ledger) — weighted risk up."],
        refs: ["acc-03", "doc-12"], engine: "ondevice",
      },
    ],
    documents: [
      {
        id: "doc-01", title: "Sutr Pitch Deck v7", type: "Deck", tags: ["investor", "fundraising", "seed"],
        relatedTo: "Kalaari Capital round", addedAt: daysAgoISO(18),
        summary: "Current raise deck: 4-agent story, per-event pricing, Rajasthan wedge market.",
        content: "Problem: Indian wedding planners coordinate 40–90 vendors per event on sheets and calls. Solution: Sutr's four agents — sales, marketing, ops, vault — one thread per event. Traction: 5 paying planner accounts, 92% setup completion at Ritika Malhotra Events. Model: per-event pricing ₹9K–₹40K+. Ask: ₹4.2Cr seed.",
        ocr: false, access: "owner", trace: ["Auto-tagged: type=Deck (keyword 'pitch deck')", "Related to investor round from title + content"],
      },
      {
        id: "doc-02", title: "MVP Build Spec v2", type: "Spec", tags: ["product", "engineering", "mvp"],
        relatedTo: "Internal", addedAt: daysAgoISO(90),
        summary: "Event timeline engine, vendor ledger, agent context store schema.",
        content: "Core objects: Event, Vendor, Task, Timeline. Agent context store: shared read/write with append-only activity log. Hard rules: no autonomous send, no autonomous spend, no fabricated grounding. Gmail integration is drafts-only via OAuth.",
        ocr: false, access: "owner", trace: ["Auto-tagged: type=Spec", "Tagged product+engineering from content"],
      },
      {
        id: "doc-03", title: "Brand Guidelines — Plum & Gold", type: "Brand", tags: ["identity", "voice", "design"],
        relatedTo: "Internal", addedAt: daysAgoISO(120),
        summary: "Voice: warm authority, no jargon. Palette: deep plum #1d0f29, temple gold #d4a24e, rani accent.",
        content: "Sutr speaks like a trusted banquets manager, not a startup. Short sentences. Name the planner's city, season, and vendors concretely. Tagline: 'every thread, connected.' Never say 'AI-powered revolution'. Always show the thread that connects a problem to its fix.",
        ocr: false, access: "owner", trace: ["Auto-tagged: type=Brand", "Voice rules extracted for Sales + Marketing agents"],
      },
      {
        id: "doc-04", title: "Market Research: Meragi vs WedMeGood vs Sutr", type: "Research", tags: ["competitive", "meragi", "wedmegood", "pricing"],
        relatedTo: "Competitive intelligence", addedAt: daysAgoISO(32),
        summary: "Meragi went full-stack consumer planning after Series C; WedMeGood shipped a planner CRM add-on in Aug; both bill monthly, we bill per-event.",
        content: "Meragi: raised Series C, pivoting toward consumer-side planning; planner tooling deprioritised; billing complaints common in planner forums. WedMeGood: launched planner CRM add-on in August — lead capture only, no vendor ops; still strong for discovery listings. Gap for Sutr: nobody owns the vendor-ops + timeline layer for 20+ event firms. Pricing: both competitors bill monthly subscriptions; planners with lumpy seasonal cashflow prefer our per-event pricing.",
        ocr: false, access: "owner", trace: ["Auto-tagged: competitive + competitor names", "Cited by Sales (switch pitches) and Marketing (comparison SEO)"],
      },
      {
        id: "doc-05", title: "Churn Postmortem — Q3", type: "Ops doc", tags: ["churn", "onboarding", "retention"],
        relatedTo: "Internal", addedAt: daysAgoISO(45),
        summary: "3 of 4 churned planners stalled below 60% setup within their first 14 days.",
        content: "Finding: 3 of 4 churned planners stalled below 60% setup within their first 14 days, then went silent. Second signal: open vendor-sync tickets older than 4 days doubled churn odds. Recommendation: concierge setup call at day 10 for any account under 60%; escalate stalled tickets at day 4.",
        ocr: false, access: "owner", trace: ["Auto-tagged: churn + retention", "Primary evidence source for Ops agent churn flags"],
      },
      {
        id: "doc-06", title: "Planner Master Agreement — Template", type: "Contract", tags: ["legal", "template", "planner"],
        relatedTo: "All planners", addedAt: daysAgoISO(200),
        summary: "Standard per-event services agreement, 12-month term, data ownership clause.",
        content: "This agreement covers per-event coordination services at the subscribed tier. Term: 12 months, renewing annually. Planner retains ownership of all vendor and client data; Sutr retains anonymised operational benchmarks. Termination: 30 days' notice, export guarantee within 7 days.",
        ocr: false, access: "owner", trace: ["Auto-tagged: legal + template"],
      },
      {
        id: "doc-07", title: "Vendor Agreement — Ritika Malhotra Events", type: "Contract", tags: ["vendor", "agreement", "mumbai"],
        relatedTo: "Ritika Malhotra Events", addedAt: daysAgoISO(340), expiresAt: daysFromNowISO(22),
        summary: "Annual vendor-network agreement for Ritika's Mumbai roster. RENEWS IN 22 DAYS.",
        content: "Vendor coordination agreement covering 38 vendors across caterers, décor, and photography for Ritika Malhotra Events. Rates locked for 12 months. Renewal window opens 30 days before expiry; renegotiate décor rates given 2025 inflation.",
        ocr: false, access: "owner", trace: ["Auto-tagged: vendor + city", "Expiry detected: 22 days — flagged for renewal"],
      },
      {
        id: "doc-08", title: "Vendor Agreement — Vivah Crafters", type: "Contract", tags: ["vendor", "agreement", "jaipur"],
        relatedTo: "Vivah Crafters", addedAt: daysAgoISO(356), expiresAt: daysFromNowISO(9),
        summary: "Vivah Crafters vendor-network agreement. EXPIRES IN 9 DAYS — at-risk account, renewal is a save opportunity.",
        content: "Vendor coordination agreement for Vivah Crafters, Jaipur — 17 vendors. Expiry triggers re-papering; given the account's onboarding stall, pair renewal with a concierge setup call.",
        ocr: false, access: "owner", trace: ["Auto-tagged: vendor + jaipur", "Expiry detected: 9 days — URGENT flag", "Cross-referenced acc-01 churn risk"],
      },
      {
        id: "doc-09", title: "SAFE Term Sheet — Kalaari Capital", type: "Investor", tags: ["fundraising", "confidential", "safe"],
        relatedTo: "Seed round", addedAt: daysAgoISO(25),
        summary: "₹4.2Cr SAFE, ₹18Cr cap. Counsel review pending.",
        content: "SAFE note: ₹4.2 crore at ₹18 crore post-money cap. Pro-rata rights standard. Conditions: MVP agent-log audit, 8 paying accounts by close. Confidential — owner access only.",
        ocr: false, access: "owner", trace: ["Auto-tagged: investor + confidential", "Access restricted: owner only"],
      },
      {
        id: "doc-10", title: "GST Invoice Template", type: "Finance", tags: ["billing", "gst", "template"],
        relatedTo: "All planners", addedAt: daysAgoISO(150),
        summary: "Per-event invoice with GST breakup, HSN 9985.",
        content: "Invoice template for per-event billing. HSN 9985, GST 18%. Fields: event name, city, tier, event date. Payment terms: 50% on booking, 50% post-event.",
        ocr: false, access: "owner", trace: ["Auto-tagged: finance + billing"],
      },
      {
        id: "doc-11", title: "Onboarding Playbook v3", type: "Playbook", tags: ["onboarding", "ops", "sla"],
        relatedTo: "All planners", addedAt: daysAgoISO(40),
        summary: "Day-0 to day-14 setup curve, concierge call triggers, §4 vendor-chase templates.",
        content: "Target: 80% setup by day 14. Concierge call triggers: <60% at day 10, any ticket open >4 days. §4 contains vendor-chase WhatsApp templates (caterer, décor, photography). §6 covers timeline creation for events within 30 days.",
        ocr: false, access: "owner", trace: ["Auto-tagged: onboarding + SLA", "Referenced by Ops agent recommendations"],
      },
      {
        id: "doc-12", title: "Platform SLA & Vendor Confirmation Targets", type: "Ops doc", tags: ["sla", "vendor", "timeline"],
        relatedTo: "All planners", addedAt: daysAgoISO(70),
        summary: "Full vendor confirmation at T-21 days; décor at T-28 for mandap builds.",
        content: "SLA: 100% vendor confirmation 21 days before event. Décor/mandap vendors: 28 days (build lead time). Caterer menu lock: 14 days. Breach triggers Ops agent escalation to severity 2.",
        ocr: false, access: "owner", trace: ["Auto-tagged: SLA + vendor", "Evidence source for event-timeline risks"],
      },
      {
        id: "doc-13", title: "Signed Contract — Utsav Collective (scan)", type: "Contract", tags: ["legal", "signed", "bengaluru"],
        relatedTo: "Utsav Collective", addedAt: daysAgoISO(58),
        summary: "OCR-extracted signed Studio agreement for Utsav Collective.",
        content: "[OCR extracted] SERVICE AGREEMENT between Sutr Technologies Pvt Ltd and Utsav Collective, Bengaluru. Tier: Studio, ₹14,000 per event. Signed 12 Sep by Ananya Rao, Director. Witness: K. Prasad.",
        ocr: true, access: "owner", trace: ["OCR pass: 96.2% confidence", "Entity extraction: Utsav Collective, Bengaluru, Studio tier", "Auto-linked to acc-03"],
      },
      {
        id: "doc-14", title: "IWPFA Partnership MoU", type: "Partnership", tags: ["association", "referral", "community"],
        relatedTo: "IWPFA", addedAt: daysAgoISO(100), expiresAt: daysFromNowISO(60),
        summary: "Referral MoU with Indian Wedding Planners & Founders Association. Renewal in 60 days.",
        content: "MoU: Sutr sponsors chapter meetups; IWPFA lists Sutr as recommended ops tool. Referral attribution via meetup signups. Renewal conversation due 30 days before expiry.",
        ocr: false, access: "owner", trace: ["Auto-tagged: partnership + referral", "Expiry detected: 60 days — renewal conversation due at day 30"],
      },
    ],
    drafts: [
      {
        id: "draft-01", leadId: "lead-02", angle: "Switch-from-Meragi",
        subject: "The billing gap you mentioned, Kabir — how Sutr sequences it differently",
        body: "Kabir,\n\nOn our call you said invoices at Sethi & Co. go out late because Meragi's billing sits apart from your event timelines — and clients notice. That's exactly the seam Sutr closes: every vendor ledger line is tied to an event timeline, so invoices draft themselves as milestones complete.\n\nTwo things from the call that stuck with me:\n\n1. Multi-city vendor payouts — yes, Sutr's ledger handles per-city payout batches. Ritika Malhotra Events runs Mumbai + Jaipur payouts from one ledger.\n2. Scale without the sheet-load — at 41 events a year you'd land on our Growth tier (₹24,000 per event), which includes the vendor SLA engine.\n\nI've attached nothing you didn't ask for. If your ops lead wants a walkthrough, 20 minutes this week and I'll show it on a real timeline, not slides.\n\n— Priya\nSutr · every thread, connected",
        tierPitch: "Growth · ₹24,000/event", status: "ready", createdAt: daysAgoISO(0, 4),
        trace: [
          "Retrieved lead-02: 41 events/yr, Delhi NCR, current tool Meragi, status qualified.",
          "Cross-read notes: billing-lateness pain + multi-city payout question from 3-day-old call.",
          "Compared doc-04 (Meragi billing complaints common in planner forums) — pain is structural, not anecdotal.",
          "Tier math: 41 events fits Growth band (35–59). Cited acc-02 as multi-city proof point since it runs Mumbai + Jaipur.",
          "Voice check against doc-03: concrete, no jargon, no attachments he didn't request.",
        ],
        refs: ["lead-02", "doc-04", "acc-02", "doc-03"], engine: "ondevice",
      },
    ],
    ideas: [],
    activity: [
      {
        id: "act-01", ts: daysAgoISO(0, 4), agent: "sales", action: "Draft queued", engine: "ondevice",
        summary: "Drafted switch-from-Meragi email for Kabir Sethi (lead-02), Growth tier pitch. Awaiting Priya's send.",
        trace: ["Read lead-02 notes from 3-day-old call", "Cited doc-04 competitive research on Meragi billing", "Tier math: 41 events/yr → Growth band"],
        refs: ["lead-02", "doc-04"],
      },
      {
        id: "act-02", ts: daysAgoISO(0, 7), agent: "ops", action: "Risk flagged", engine: "ondevice",
        summary: "Vendor confirmation lag for Utsav Collective's Sharma Sangeet — 7/12 confirmed, 19 days out, SLA breached by 2 days.",
        trace: ["Compared event timeline to doc-12 SLA (T-21 full confirmation)", "Weighted by caterer + décor = 61% of budget"],
        refs: ["acc-03", "doc-12"],
      },
      {
        id: "act-03", ts: daysAgoISO(0, 9), agent: "sales", action: "Inbound triaged", engine: "ondevice",
        summary: "Ankit Bansal (lead-07) replied asking per-wedding cost. Price-first buyer — queued Starter→Studio math response.",
        trace: ["Reply keyword: 'what does it cost per wedding?'", "No tools currently → entry-tier fit, upgrade path once volume proves out"],
        refs: ["lead-07"],
      },
      {
        id: "act-04", ts: daysAgoISO(1, 2), agent: "vault", action: "Expiry watch", engine: "ondevice",
        summary: "2 vendor agreements inside renewal window: Vivah Crafters (9 days), Ritika Malhotra Events (22 days).",
        trace: ["Scanned 14 documents for expiresAt < 30 days", "doc-08 cross-referenced with acc-01 churn flag — renewal doubles as save motion"],
        refs: ["doc-08", "doc-07", "acc-01"],
      },
      {
        id: "act-05", ts: daysAgoISO(1, 5), agent: "ops", action: "Churn pattern match", engine: "ondevice",
        summary: "Vivah Crafters matches the Q3 churn signature (stalled <60% setup past day 14). Sales told to HOLD the Growth upgrade pitch.",
        trace: ["acc-01: 45% setup at day 21, silent 6 days, 2 stale tickets", "doc-05 postmortem: 3 of 4 churned accounts had this exact pattern", "Wrote hold to lead-10 so Sales won't over-pitch a slipping account"],
        refs: ["acc-01", "doc-05", "lead-10"],
      },
      {
        id: "act-06", ts: daysAgoISO(1, 8), agent: "marketing", action: "Campaign diagnosed", engine: "ondevice",
        summary: "Sangeet BTS Reels underperforming: 42K impressions but CTR 0.8% vs 2.9% portfolio average — audience resolved to couples, not planners.",
        trace: ["cam-02 CTR 0.80% vs portfolio avg 2.87%", "Reply quality: 4 replies, 0 planner-intent", "Channel-goal mismatch: IG algorithm served the wedding hashtag audience"],
        refs: ["cam-02"],
      },
      {
        id: "act-07", ts: daysAgoISO(2, 3), agent: "vault", action: "Document ingested", engine: "ondevice",
        summary: "OCR pass on signed Utsav Collective contract — extracted parties, tier (Studio), signatory. Searchable now.",
        trace: ["OCR confidence 96.2%", "Entities: Utsav Collective, Bengaluru, Studio ₹14,000/event", "Linked to acc-03"],
        refs: ["doc-13", "acc-03"],
      },
      {
        id: "act-08", ts: daysAgoISO(2, 6), agent: "system", action: "Guardrail enforced", engine: "ondevice",
        summary: "Blocked an autonomous send attempt in test harness — Gmail integration is drafts-only by design. 0 emails left the account without Priya.",
        trace: ["Policy check: send pathway requires owner click", "Draft retained in queue"],
        refs: ["draft-01"],
      },
    ],
    digest: null,
    lastOpsScan: null,
  };
}

/* ---------------- store mechanics ---------------- */

const LS_KEY = "sutr.state.v1";

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.seedVersion !== SEED_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

let state: AppState = load() ?? seedState();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — app keeps running in memory */
  }
}

export function getState(): AppState {
  return state;
}

export function mutate(fn: (s: AppState) => AppState) {
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

export function resetDemo() {
  state = seedState();
  persist();
  listeners.forEach((l) => l());
}

/* ---------------- shared write actions (orchestrator API) ---------------- */

export function log(
  agent: AgentName,
  action: string,
  summary: string,
  trace: string[],
  refs: string[],
  engine: Engine
) {
  mutate((s) => ({
    ...s,
    activity: [
      { id: uid("act"), ts: new Date().toISOString(), agent, action, summary, trace, refs, engine },
      ...s.activity,
    ].slice(0, 250),
  }));
}

export function updateLead(id: string, patch: Partial<Lead>) {
  mutate((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
}

export function addLead(lead: Lead) {
  mutate((s) => ({ ...s, leads: [lead, ...s.leads] }));
}

export function addDraft(draft: Draft) {
  mutate((s) => ({ ...s, drafts: [draft, ...s.drafts] }));
}

export function updateDraft(id: string, patch: Partial<Draft>) {
  mutate((s) => ({ ...s, drafts: s.drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

export function addIdea(idea: Idea) {
  mutate((s) => ({ ...s, ideas: [idea, ...s.ideas] }));
}

export function updateIdea(id: string, patch: Partial<Idea>) {
  mutate((s) => ({ ...s, ideas: s.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
}

export function addRisk(risk: OpsRisk) {
  mutate((s) => ({ ...s, risks: [risk, ...s.risks] }));
}

export function updateRisk(id: string, patch: Partial<OpsRisk>) {
  mutate((s) => ({ ...s, risks: s.risks.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function addDocument(doc: Doc) {
  mutate((s) => ({ ...s, documents: [doc, ...s.documents] }));
}

export function setDigest(digest: Digest) {
  mutate((s) => ({ ...s, digest }));
}

export function setLastOpsScan(iso: string) {
  mutate((s) => ({ ...s, lastOpsScan: iso }));
}

export function setOwnerName(name: string) {
  mutate((s) => ({ ...s, ownerName: name || "Priya" }));
}
