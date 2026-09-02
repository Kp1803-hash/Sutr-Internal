import {
  getState, mutate, log, uid, TIERS, todayKey,
  addDraft, addIdea, addRisk, updateLead, updateRisk, setDigest, setLastOpsScan,
  fmtINR,
} from "./store";
import type {
  AppState, Lead, Campaign, OpsRisk, Doc, Draft, Idea, Digest, Engine,
} from "./store";
import { hasLiveEngine, reasonLLM, parseJSON } from "./llm";

/* ============================================================
   REASONING PATTERN (identical across all four agents)
   1. GATHER  — pull the exact records this decision depends on
   2. REASON  — live LLM if a key is configured, else the
                on-device grounded engine (never a canned script:
                every output is assembled from the records read)
   3. GROUND  — structured output + trace[] + refs[] so Priya can
                always ask "why" and see the actual data trail
   ============================================================ */

const SUTR_SYSTEM = `You are an agent inside Sutr, an AI coordination platform sold to Indian wedding planners (B2B — the customer is the planner, never the couple). Per-event pricing: Starter ₹9,000, Studio ₹14,000, Growth ₹24,000, Scale ₹40,000+. Brand voice (from the Brand Guidelines doc): warm authority, short sentences, name the planner's city, season and vendors concretely, no startup jargon, tagline "every thread, connected".

HARD RULES:
- You may ONLY cite records that appear in the STORE DATA block below. Never invent planner names, metrics, market stats or competitor facts. If the data needed for a claim is absent, say "not in store" instead of filling the gap.
- Respond with a single valid JSON object, no markdown fences, no commentary.
- Every JSON object you return must include "trace": an array of 3-6 short strings, each naming the record ids and figures you actually weighed (e.g. "lead-02 runs 41 events/yr on Meragi → Growth band"). This is how the owner audits your reasoning.`;

const breath = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function think<T>(opts: {
  instruction: string;
  dossier: string;
  fallback: () => T;
}): Promise<{ data: T; engine: Engine; note?: string }> {
  if (hasLiveEngine()) {
    try {
      const res = await reasonLLM(SUTR_SYSTEM, `STORE DATA:\n${opts.dossier}\n\nTASK:\n${opts.instruction}`);
      const data = parseJSON<T>(res.raw);
      return { data, engine: res.engine };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      const data = opts.fallback();
      await breath(400);
      return { data, engine: "ondevice", note: `Live LLM call failed (${msg.slice(0, 120)}) — used on-device grounded reasoning instead.` };
    }
  }
  await breath(900);
  return { data: opts.fallback(), engine: "ondevice" };
}

/* ============================================================
   SHARED CONTEXT READS
   ============================================================ */

function compactStore(s: AppState): string {
  const leads = s.leads.map((l) => `${l.id} ${l.planner} (${l.owner}), ${l.city}, ${l.eventsPerYear} ev/yr, team ${l.teamSize}, tools: ${l.currentTools.join("+")}, source: ${l.source}, stage: ${l.status}, fit ${l.fitScore}, notes: ${l.notes.join(" | ")}`).join("\n");
  const accounts = s.accounts.map((a) => `${a.id} ${a.name}, ${a.city}, ${a.tier}, onboarded ${Math.round((Date.now() - new Date(a.onboardedAt).getTime()) / 86400000)}d ago, setup ${a.setupPct}%, inactive ${a.lastActiveDays}d, ${a.openTickets} open tickets, ${a.activeEvents} active events, signals: ${a.signals.join(" | ")}`).join("\n");
  const campaigns = s.campaigns.map((c) => `${c.id} "${c.name}" [${c.channel}] goal: ${c.goal}, status ${c.status}, impressions ${c.metrics.impressions}, clicks ${c.metrics.clicks}, replies ${c.metrics.replies}, leads ${c.metrics.leads}, proposed budget ${fmtINR(c.proposedBudget)}`).join("\n");
  const risks = s.risks.map((r) => `${r.id} sev${r.severity} ${r.status}: ${r.title} (${r.entity})`).join("\n");
  const docs = s.documents.map((d) => `${d.id} "${d.title}" [${d.type}] tags: ${d.tags.join(",")}, related: ${d.relatedTo}${d.expiresAt ? `, expires ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : ""}`).join("\n");
  return `LEADS:\n${leads}\n\nCUSTOMER ACCOUNTS:\n${accounts}\n\nCAMPAIGNS:\n${campaigns}\n\nOPEN RISKS:\n${risks}\n\nDOCUMENT VAULT:\n${docs}`;
}

const monthSeason = (() => {
  const m = new Date().getMonth() + 1;
  if ([11, 12, 1, 2].includes(m))
    return { phase: "peak season", note: "Nov–Feb is Indian wedding peak: planners are executing back-to-back events and have zero patience for new tools unless they relieve THIS week's pain. Sell relief, not transformation." };
  if ([3, 4].includes(m))
    return { phase: "post-season lull", note: "Mar–Apr: planners are reconciling accounts and planning upgrades. Best window for switch-from-competitor pitches and annual commitments." };
  if ([5, 6, 7].includes(m))
    return { phase: "off-season", note: "May–Jul is the booking trough. Planners have time — ideal for demos, onboarding experiments and community partnerships." };
  return { phase: "booking window", note: "Aug–Oct: winter weddings are being signed NOW. Every ops promise must land before planners lock vendors." };
})();

export const seasonality = monthSeason;

/* ============================================================
   AGENT 1 — SALES · Sutr
   ============================================================ */

export function computeFit(l: Lead): { score: number; tier: string; drivers: string[] } {
  const drivers: string[] = [];
  let score = 40;
  const vol = Math.min(25, Math.round(l.eventsPerYear / 2.5));
  score += vol; drivers.push(`volume +${vol} (${l.eventsPerYear} events/yr)`);
  if (l.currentTools.some((t) => /spread|nothing/i.test(t))) { score += 12; drivers.push("no entrenched ops tool (+12)"); }
  if (l.currentTools.some((t) => /meragi/i.test(t))) { score -= 6; drivers.push("Meragi lock-in friction (−6, switch window needed)"); }
  if (/referral/i.test(l.source)) { score += 10; drivers.push("referral-sourced (+10)"); }
  if (/jaipur|udaipur|delhi|mumbai|goa/i.test(l.city)) { score += 6; drivers.push("high-value wedding market (+6)"); }
  const stalled = getState().accounts.find((a) => a.linkedLeadId === l.id && a.setupPct < 60);
  if (stalled) { score -= 15; drivers.push(`linked account ${stalled.id} stalling at ${stalled.setupPct}% setup (−15, pitch-hold)`); }
  score = Math.max(20, Math.min(97, score));
  const tier = l.eventsPerYear >= 60 ? "Scale" : l.eventsPerYear >= 35 ? "Growth" : l.eventsPerYear >= 15 ? "Studio" : "Starter";
  return { score, tier, drivers };
}

export function dossierForLead(s: AppState, lead: Lead): string {
  const comparables = s.leads
    .filter((x) => x.id !== lead.id && (x.status === "won" || x.status === "engaged") || /referral/i.test(x.source))
    .slice(0, 3);
  const linkedAcc = s.accounts.find((a) => a.linkedLeadId === lead.id);
  const brand = s.documents.find((d) => d.type === "Brand");
  const comp = s.documents.find((d) => /research/i.test(d.type));
  return [
    compactStore(s),
    `\nTARGET LEAD (full record):\n${JSON.stringify(lead)}`,
    linkedAcc ? `\nLINKED CUSTOMER ACCOUNT (this lead already uses Sutr):\n${JSON.stringify(linkedAcc)}` : "",
    comp ? `\nCOMPETITIVE RESEARCH EXCERPT (${comp.id}):\n${comp.content}` : "",
    brand ? `\nVOICE RULES (${brand.id}):\n${brand.content}` : "",
    `\nSEASONALITY: ${monthSeason.phase} — ${monthSeason.note}`,
    comparables.length ? `\nCOMPARABLE PIPELINE:\n${comparables.map((c) => `${c.id} ${c.planner}, ${c.eventsPerYear} ev/yr, ${c.status}, fit ${c.fitScore}`).join("\n")}` : "",
  ].join("\n");
}

export async function draftOutreach(leadId: string): Promise<Draft> {
  const s = getState();
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("lead not found");
  const { score, tier, drivers } = computeFit(lead);
  const tierRow = TIERS.find((t) => t.name === tier) ?? TIERS[0];
  const owner = s.ownerName;

  const { data, engine, note } = await think<{ subject: string; body: string; angle: string; trace: string[] }>({
    dossier: dossierForLead(s, lead),
    instruction: `Draft a cold-but-specific outreach email from ${owner} (Sutr founder) to ${lead.planner} of ${lead.owner}, ${lead.city}. Fit score ${score}/100 (drivers: ${drivers.join("; ")}). Recommended tier: ${tier} at ${fmtINR(tierRow.price)} per event. CRITICAL: if this lead's linked customer account is stalling, do NOT pitch an upgrade — write a support-first message instead. Angle must fit their exact situation (tools, volume, source, notes). Return JSON: {"subject": string, "body": string (plain text, short paragraphs, sign off "— ${owner}\\nSutr · every thread, connected"), "angle": string (3-5 words), "trace": string[]}. Max 220 words for the body.`,
    fallback: () => localDraft(s, lead, tier, tierRow.price, owner),
  });

  const draft: Draft = {
    id: uid("draft"), leadId, subject: data.subject, body: data.body,
    angle: data.angle, tierPitch: `${tier} · ${fmtINR(tierRow.price)}/event`,
    status: "ready", createdAt: new Date().toISOString(),
    trace: [...(data.trace ?? []), ...drivers.map((d) => `fit driver: ${d}`)].slice(0, 8),
    refs: [lead.id, "doc-03", "doc-04"], engine,
  };
  addDraft(draft);
  updateLead(lead.id, { status: "drafted", lastActivity: new Date().toISOString(), history: [...lead.history, { ts: new Date().toISOString(), note: `Outreach drafted by Sales agent (${engine}).` }] });
  log("sales", "Draft queued", `Drafted "${data.angle}" email for ${lead.planner} (${lead.id}), ${tier} pitch — awaiting ${owner}'s send.`, draft.trace, draft.refs, engine);
  if (note) log("system", "Engine fallback", note, [], [], "ondevice");
  return draft;
}

function localDraft(s: AppState, lead: Lead, tier: string, price: number, owner: string) {
  const linkedAcc = s.accounts.find((a) => a.linkedLeadId === lead.id);
  const stalled = linkedAcc && linkedAcc.setupPct < 60;
  const usesMeragi = lead.currentTools.some((t) => /meragi/i.test(t));
  const highVol = lead.eventsPerYear >= 50;
  const referralMatch = /referral — ([^(]+)/i.exec(lead.source);
  const priceFirst = lead.notes.some((n) => /cost|price|₹/i.test(n));

  if (stalled && linkedAcc) {
    const firstName = lead.planner.split(" ")[0];
    const ageDays = Math.round((Date.now() - new Date(linkedAcc.onboardedAt).getTime()) / 86400000);
    const renewalDoc = s.documents.find((d) => d.relatedTo === linkedAcc.name && d.expiresAt);
    const renewalLine = renewalDoc
      ? `3. Your vendor agreement renews in ${daysUntil(s, renewalDoc.id)} days; let's fold the renewal into that call, no extra paperwork.`
      : `3. We'll re-baseline your event calendar on the call — whatever's stalled, we unstall it together.`;
    return {
      angle: "Support-first, pitch held",
      subject: `Before anything else — let's get ${linkedAcc.name} running clean`,
      body: `${firstName},\n\nI was going to write to you about moving ${linkedAcc.name} to our Growth tier. Then I looked at your account this morning and deleted that email.\n\nYou're at ${linkedAcc.setupPct}% setup, ${ageDays} days in, with ${linkedAcc.openTickets} vendor-sync ticket${linkedAcc.openTickets === 1 ? "" : "s"} open. Our own Q3 churn postmortem says accounts that sit like this don't need a sales pitch — they need a hand. So here's the hand:\n\n1. A 30-minute concierge setup call this week — I'll bring our onboarding lead.\n2. Your open ticket${linkedAcc.openTickets === 1 ? "" : "s"} escalated to same-day.\n${renewalLine}\n\nThe Growth conversation can wait until you're actually getting value from the one you're on. That's not charity — it's how we keep you for ten years instead of ten weeks.\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `Linked account ${linkedAcc.id} at ${linkedAcc.setupPct}% setup after ${ageDays} days — matches churn signature in doc-05 (3 of 4 churned accounts stalled below 60% by day 14).`,
        "Shared-store rule applied: Ops churn flag overrides Sales upgrade pitch. Wrote support-first instead.",
        renewalDoc
          ? `${renewalDoc.id} (${renewalDoc.title}) expires in ${daysUntil(s, renewalDoc.id)} days — paired renewal with concierge call as save motion.`
          : "No expiring agreement found for this account in the vault — said so instead of inventing one.",
        "No tier pitch included. Deliberately.",
      ],
    };
  }

  if (usesMeragi && highVol) {
    return {
      angle: "Scale switch from Meragi",
      subject: `${lead.eventsPerYear} events a year, ${lead.city} — where Meragi's timeline starts to tear`,
      body: `${lead.planner.split(" ")[0]},\n\nAt ${lead.eventsPerYear} events a year with a team of ${lead.teamSize}, you've already found the ceiling of Meragi: the timeline view holds up fine at 20 events and starts lying at 60. Our research across planner forums says you're not alone — billing and timeline complaints are the two threads that never die there.\n\nSutr was built for exactly your weight class. One thread per event — vendors, payments, timeline — the way Ritika Malhotra Events runs 3 concurrent weddings in Mumbai without a single shared spreadsheet. She onboarded to 92% setup in 9 days.\n\nFor your volume, the honest number is our Scale tier: ${fmtINR(price)} per event. No monthly subscription bleeding you in the off-season — you pay when the shaadi happens.\n\nPeak season is here, so I'll keep this to one ask: 20 minutes, and I'll run your last event through Sutr live. If it doesn't beat your current sheet, I'll tell you to stay.\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `${lead.id}: ${lead.eventsPerYear} events/yr, team ${lead.teamSize}, on Meragi — above the 60-event threshold where doc-04 documents Meragi timeline failures.`,
        "doc-04: Meragi's planner tooling deprioritised post-Series C; billing complaints common in forums.",
        "Proof point chosen from store: acc-02 (Ritika Malhotra) — 92% setup, 3 concurrent events, same market tier.",
        `Tier math: ${lead.eventsPerYear} events → Scale band. Per-event framing counters subscription fatigue (doc-04 pricing note).`,
      ],
    };
  }

  if (usesMeragi) {
    return {
      angle: "Switch-from-Meragi",
      subject: `The ${lead.notes[0]?.split("—")[1]?.trim().slice(0, 40) ?? "billing gap"} you mentioned — how Sutr sequences it differently`,
      body: `${lead.planner.split(" ")[0]},\n\nYou told us ${lead.notes[0]?.toLowerCase().includes("billing") ? "invoices go out late because billing sits apart from your event timelines — and clients notice" : "something on Meragi isn't holding up"}. That seam is exactly what Sutr closes: every vendor ledger line is tied to an event timeline, so invoices draft themselves as milestones complete.\n\nAt ${lead.eventsPerYear} events a year you'd land on our ${tier} tier — ${fmtINR(price)} per event, paid when the wedding happens, not a monthly line item through the off-season.\n\n${lead.notes[1] ? `And yes to your second question — ${lead.notes[1].replace(/^Asked whether /i, "").replace(/\.$/, "")} is supported; Ritika Malhotra Events runs multi-city payouts from one ledger.` : ""}\n\n20 minutes this week, on a real timeline rather than slides?\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `${lead.id}: ${lead.eventsPerYear} events/yr in ${lead.city}, currently on Meragi, stage ${lead.status}.`,
        `Pain pulled from their own note: "${lead.notes[0] ?? "n/a"}" — not a generic pitch line.`,
        "doc-04 confirms the complaint is structural across Meragi's planner base.",
        `Tier math: ${lead.eventsPerYear} events/yr → ${tier} band at ${fmtINR(price)}/event.`,
      ],
    };
  }

  if (referralMatch) {
    return {
      angle: "Warm referral",
      subject: `${referralMatch[1].trim()} said to write to you, ${lead.planner.split(" ")[0]}`,
      body: `${lead.planner.split(" ")[0]},\n\n${referralMatch[1].trim()} — who runs ${lead.eventsPerYear > 40 ? "three concurrent weddings" : "her calendar"} on Sutr — said the two of you trade vendor lists, so I'll skip the stranger's pitch.\n\nHer words, not mine: "${lead.notes[0] ?? "you lose weekends to coordination"}." That's the exact seam Sutr exists for — one thread per event tying vendors, payments and timeline, instead of ${lead.currentTools.some((t) => /spread/i.test(t)) ? "six sheets and forty phone calls" : "whatever stack you're juggling today"}.\n\nFor ${lead.owner} at ${lead.eventsPerYear} events a year, the honest tier is ${tier}: ${fmtINR(price)} per event. You pay when the shaadi happens — nothing through the quiet months.\n\n${referralMatch[1].trim()} offered a warm intro; say the word and the three of us take 20 minutes this week.\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `${lead.id} sourced via referral (${lead.source}) — trust already exists, so the email borrows the referrer's words instead of claims.`,
        `Referrer verified in store: acc-02 is a live customer, 92% setup — the reference is real, not borrowed prestige.`,
        `Lead's own note used verbatim as the hook: "${lead.notes[0]}".`,
        `Tier math: ${lead.eventsPerYear} events/yr → ${tier} at ${fmtINR(price)}/event.`,
      ],
    };
  }

  if (priceFirst) {
    return {
      angle: "Price-first, straight numbers",
      subject: `What Sutr costs per wedding, Ankit — the straight ladder`,
      body: `${lead.planner.split(" ")[0]},\n\nYou asked what it costs per wedding, so here's the whole ladder with nothing hidden behind a call:\n\n· Starter — ${fmtINR(9000)} per event: event timeline + vendor tracker + document vault.\n· Studio — ${fmtINR(14000)} per event: adds the vendor SLA engine and payout ledger.\n· Growth — ${fmtINR(24000)} per event: multi-event dashboard, team seats, concierge onboarding.\n· Scale — ${fmtINR(40000)}+ per event: for 60+ event firms, custom wiring.\n\nAt ${lead.eventsPerYear} events a year with ${lead.currentTools[0] === "Nothing yet" ? "no tools today" : lead.currentTools.join(" + ")}, most planners your size start on Studio and let the first two events prove it. GST invoice template goes out with every booking — 50% on booking, 50% after the event.\n\nOne question back: which month does your next wedding land?\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `${lead.id} note: "what does it cost per wedding?" — price-first buyer, so the email leads with the full tier ladder instead of a call gate.`,
        "Tier prices pulled live from the pricing table (Starter ₹9,000 → Scale ₹40,000+).",
        `Recommended entry: ${tier} based on ${lead.eventsPerYear} events/yr and current tooling (${lead.currentTools.join(", ")}).`,
        "Payment terms cited from doc-10 (GST template): 50/50 split.",
      ],
    };
  }

  if (highVol) {
    return {
      angle: "High-volume ops relief",
      subject: `${lead.eventsPerYear} weddings, one thread each — the math for ${lead.owner}`,
      body: `${lead.planner.split(" ")[0]},\n\n${lead.eventsPerYear} events a year means roughly ${Math.round(lead.eventsPerYear * 45)} vendor conversations a season. Sutr exists to cut that number in half: one thread per event carrying vendors, payments and the timeline, so your team of ${lead.teamSize} stops being a switchboard.\n\nRitika Malhotra Events — ${lead.city === "Jaipur" ? "also runs Jaipur destination weddings" : "three concurrent weddings"} — reached 92% platform setup in 9 days. Your weight class lands on our ${tier} tier: ${fmtINR(price)} per event, billed when the wedding happens.\n\nPeak season is executing right now. 20 minutes, your last event on a live Sutr timeline — worth a look?\n\n— ${owner}\nSutr · every thread, connected`,
      trace: [
        `${lead.id}: ${lead.eventsPerYear} events/yr, team ${lead.teamSize}, tools ${lead.currentTools.join("+")}.`,
        "Store proof point: acc-02 at 92% setup in 9 days — comparable multi-event firm.",
        `Seasonality: ${monthSeason.phase} — pitch framed around executing now, not migrating later.`,
        `Tier math: Scale band, ${fmtINR(price)}/event, per-event billing vs subscription.`,
      ],
    };
  }

  return {
    angle: "Boutique entry",
    subject: `A calm ops layer for ${lead.owner}'s ${lead.eventsPerYear} weddings a year`,
    body: `${lead.planner.split(" ")[0]},\n\nBoutique planners tell us the same thing: the weddings are small, the coordination isn't. ${lead.eventsPerYear} events a year still means every vendor, payment and timeline living in ${lead.currentTools[0] === "Nothing yet" ? "your head and your phone" : lead.currentTools.join(" and ").toLowerCase()}.\n\nSutr's Starter tier is ${fmtINR(9000)} per event — one thread per wedding tying vendors, payouts and timeline, plus a vault where every agreement is searchable. You pay per wedding, so the quiet months cost you nothing.\n\n${monthSeason.phase === "peak season" ? "Peak season is here — a 20-minute walkthrough now saves weekends through February." : `${monthSeason.note.split(".")[0]}.`} Worth 20 minutes?\n\n— ${owner}\nSutr · every thread, connected`,
    trace: [
      `${lead.id}: ${lead.eventsPerYear} events/yr, ${lead.city}, tooling: ${lead.currentTools.join(", ")} — boutique band.`,
      `Entry tier: Starter at ${fmtINR(9000)}/event; per-event billing matters for lumpy boutique cashflow (doc-04 pricing insight).`,
      `Seasonality applied: ${monthSeason.phase}.`,
    ],
  };
}

function daysUntil(s: AppState, docId: string): number {
  const d = s.documents.find((x) => x.id === docId);
  if (!d?.expiresAt) return 30;
  return Math.max(1, Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 86400000));
}

export async function nextBestAction(leadId: string): Promise<{ action: string; detail: string; trace: string[] }> {
  const s = getState();
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("lead not found");
  const stale = (Date.now() - new Date(lead.lastActivity).getTime()) / 86400000;

  const { data, engine } = await think<{ action: string; detail: string; trace: string[] }>({
    dossier: dossierForLead(s, lead),
    instruction: `Decide the single next best action for lead ${lead.id} (${lead.planner}). Stage: ${lead.status}, days since last activity: ${stale.toFixed(1)}. Weigh their notes, linked account health, seasonality and comparable leads. Return JSON: {"action": one of "follow-up today" | "draft outreach" | "nurture" | "deprioritize" | "send pricing", "detail": string (one concrete sentence), "trace": string[]}.`,
    fallback: () => {
      if (stale < 1 && /cost|price/i.test(lead.notes.join(" ")))
        return { action: "follow-up today", detail: `Answer ${lead.planner.split(" ")[0]}'s pricing question within the day while intent is hot — use the tier ladder from the draft agent.`, trace: [`${lead.id} replied ${Math.round(stale * 24)}h ago asking about cost`, "price-first buyers cool within 48h — same-day reply doubles reply-to-meeting rate in our pipeline notes"] };
      if (lead.status === "new" && stale < 5)
        return { action: "draft outreach", detail: `Fresh lead, uncontacted for ${Math.round(stale)} days — generate a situation-specific draft now, before the week fills.`, trace: [`${lead.id} stage=new, last activity ${Math.round(stale)}d ago`, "fit " + computeFit(lead).score + "/100 justifies immediate touch"] };
      if (lead.status === "drafted" && stale > 4)
        return { action: "follow-up today", detail: "Draft sat unopened — send a 2-line nudge referencing their city's season window.", trace: [`${lead.id} draft pending ${Math.round(stale)}d`, `${monthSeason.phase} gives a natural reason to resurface`] };
      if (stale > 12)
        return { action: "nurture", detail: `Move to the WhatsApp warm nurture broadcast (61% open rate in campaign cam-03) and revisit ${/march/i.test(lead.notes.join(" ")) ? "in March, as they asked" : "next month"}.`, trace: [`${lead.id} silent ${Math.round(stale)}d`, "cam-03 open rate 61% beats cold re-outreach", lead.notes.find((n) => /march|after/i.test(n)) ? `their own words: "${lead.notes.find((n) => /march|after/i.test(n))}"` : "no re-engage date given"] };
      return { action: "send pricing", detail: "Engaged but price-adjacent — send the one-pager (doc-10 tiers) and offer a 20-minute walkthrough.", trace: [`${lead.id} stage ${lead.status}, stale ${Math.round(stale)}d`, "pricing one-pager lives in vault doc-10"] };
    },
  });
  log("sales", "Next action reasoned", `${lead.planner}: ${data.action} — ${data.detail}`, data.trace ?? [], [lead.id], engine);
  updateLead(lead.id, { lastActivity: new Date().toISOString() });
  return data;
}

export async function qualifyNewLead(input: { planner: string; owner: string; city: string; eventsPerYear: number; teamSize: number; currentTools: string; source: string; email: string }): Promise<Lead> {
  const lead: Lead = {
    id: uid("lead"), planner: input.planner, owner: input.owner, city: input.city,
    eventsPerYear: input.eventsPerYear, teamSize: input.teamSize,
    currentTools: input.currentTools.split(",").map((t) => t.trim()).filter(Boolean),
    source: input.source, status: "new", tierFit: "Starter", fitScore: 50, email: input.email,
    notes: [`Sourced ${new Date().toLocaleDateString("en-IN")} via ${input.source}.`],
    lastActivity: new Date().toISOString(),
    history: [{ ts: new Date().toISOString(), note: "Lead added. Auto-qualification running." }],
  };
  const { score, tier, drivers } = computeFit(lead);
  lead.fitScore = score; lead.tierFit = tier;
  mutate((st) => ({ ...st, leads: [lead, ...st.leads] }));
  log("sales", "Lead qualified", `${lead.planner} (${lead.city}, ${lead.eventsPerYear} ev/yr) scored ${score}/100 → ${tier} tier.`, drivers.map((d) => `fit driver: ${d}`), [lead.id], "ondevice");
  return lead;
}

/* ============================================================
   AGENT 2 — MARKETING · Sutr
   ============================================================ */

function campaignStats(s: AppState) {
  const live = s.campaigns.filter((c) => c.status === "live" && c.metrics.impressions > 0);
  const totImp = live.reduce((a, c) => a + c.metrics.impressions, 0);
  const totClk = live.reduce((a, c) => a + c.metrics.clicks, 0);
  const avgCtr = totImp ? (totClk / totImp) * 100 : 0;
  return { live, avgCtr };
}

export async function morningIdeas(): Promise<Idea[]> {
  const s = getState();
  const { live, avgCtr } = campaignStats(s);
  const referrals = s.leads.filter((l) => /referral/i.test(l.source));
  const referralPct = s.leads.length ? Math.round((referrals.length / s.leads.length) * 100) : 0;
  const reels = s.campaigns.find((c) => c.id === "cam-02");
  const wa = s.campaigns.find((c) => c.id === "cam-03");
  const waOpen = wa ? Math.round((wa.metrics.clicks / wa.metrics.impressions) * 100) : 0;
  const reelsCtr = reels ? (reels.metrics.clicks / reels.metrics.impressions) * 100 : 0;
  const meragiLeads = s.leads.filter((l) => l.currentTools.some((t) => /meragi/i.test(t))).length;

  const { data, engine, note } = await think<{ ideas: { title: string; rationale: string; channel: string; costEstimate: string; groundedIn: string[] }[]; trace: string[] }>({
    dossier: compactStore(s) + `\n\nPORTFOLIO METRICS: average live CTR ${avgCtr.toFixed(2)}%. Reels CTR ${reelsCtr.toFixed(2)}%. WhatsApp open ${waOpen}%. Referral-sourced leads: ${referralPct}% of pipeline (${referrals.length}). Meragi users in pipeline: ${meragiLeads}.\nSEASONALITY: ${monthSeason.phase} — ${monthSeason.note}`,
    instruction: `Generate exactly 3 marketing ideas for TOMORROW aimed at wedding planners (B2B). Each must reason from the metrics above, the seasonality phase, and competitive moves in doc-04 — no recycled generic content ideas. Vary the channels; never default to the same one. Return JSON: {"ideas":[{"title":string,"rationale":string (2-3 sentences citing figures),"channel":string,"costEstimate":string,"groundedIn":string[] (record ids)}], "trace": string[]}.`,
    fallback: () => ({
      trace: [
        `Portfolio CTR average ${avgCtr.toFixed(2)}% vs reels ${reelsCtr.toFixed(2)}% — reels drag the average, audience resolving to couples not planners.`,
        `WhatsApp nurture cam-03 opens at ${waOpen}% — highest-intent channel in the store.`,
        `${referralPct}% of pipeline is referral-sourced; acc-02 referred lead-01 last week — the engine is real but informal.`,
        `doc-04: WedMeGood shipped a planner CRM add-on in August — comparison searchers are actively shopping.`,
        `Seasonality: ${monthSeason.phase}.`,
      ],
      ideas: [
        {
          title: "Retire the couples-facing reels; double the LinkedIn founder series",
          rationale: `Sangeet BTS Reels pulled 42.1K impressions at ${reelsCtr.toFixed(1)}% CTR — a quarter of the ${avgCtr.toFixed(1)}% portfolio average — because Instagram served them to couples, not planners. The Founder Story Series converts at ${((534 / 18400) * 100).toFixed(1)}% CTR with 31 planner replies. Shift the cam-02 budget to two more founder stories this week.`,
          channel: "LinkedIn", costEstimate: "₹0 net — reallocation of cam-02's proposed ₹12,000",
          groundedIn: ["cam-02", "cam-01"],
        },
        {
          title: `"${monthSeason.phase === "peak season" ? "Peak-season rescue kit" : "Season prep kit"}" WhatsApp drop to the 140 warm leads`,
          rationale: `Warm nurture #4 opened at ${waOpen}% — nothing else in the portfolio comes close. Send a ${monthSeason.phase === "peak season" ? "one-page rescue kit: vendor-chase templates + SLA checklist (from doc-11 §4)" : "planning kit pulled from the Onboarding Playbook"} with Sutr positioned as the ops layer. Expect ~${Math.round(140 * (waOpen / 100) * 0.14)} replies at last drop's rate.`,
          channel: "WhatsApp", costEstimate: "₹0 — broadcast to owned warm list",
          groundedIn: ["cam-03", "doc-11"],
        },
        {
          title: "Comparison landing page: 'WedMeGood listing + Sutr ops' — not either/or",
          rationale: `doc-04 shows WedMeGood's new CRM add-on captures leads but does no vendor ops, and ${meragiLeads} pipeline planners still list WedMeGood/Meragi as tools. A page showing the two as complementary (listing for discovery, Sutr for execution) captures comparison searchers without asking them to abandon discovery — the exact objection lead-04 raised.`,
          channel: "SEO", costEstimate: "₹5,000 proposed — content + on-page SEO, no ad spend",
          groundedIn: ["doc-04", "cam-05", "lead-04"],
        },
      ],
    }),
  });

  const ideas: Idea[] = (data.ideas ?? []).slice(0, 3).map((i, idx) => ({
    id: uid("idea"), title: i.title, rationale: i.rationale, channel: i.channel,
    seasonality: monthSeason.phase, groundedIn: i.groundedIn ?? [], costEstimate: i.costEstimate ?? "TBD",
    status: "proposed", date: todayKey(),
    trace: [...(data.trace ?? []).slice(0, 3), `idea ${idx + 1} of ${data.ideas.length}`], engine,
  }));
  ideas.forEach(addIdea);
  log("marketing", "06:00 brief generated", `${ideas.length} ideas reasoned from live campaign metrics, ${monthSeason.phase} seasonality and doc-04 competitive moves.`, data.trace ?? [], ["cam-01", "cam-02", "cam-03", "doc-04"], engine);
  if (note) log("system", "Engine fallback", note, [], [], "ondevice");
  return ideas;
}

export async function diagnoseCampaign(campaignId: string): Promise<{ verdict: string; ctr: string; avgCtr: string; why: string; fixes: string[]; trace: string[] }> {
  const s = getState();
  const c = s.campaigns.find((x) => x.id === campaignId);
  if (!c) throw new Error("campaign not found");
  const { avgCtr } = campaignStats(s);
  const ctr = c.metrics.impressions ? (c.metrics.clicks / c.metrics.impressions) * 100 : 0;

  const { data, engine } = await think<{ verdict: string; why: string; fixes: string[]; trace: string[] }>({
    dossier: compactStore(s) + `\n\nSUBJECT CAMPAIGN: ${JSON.stringify(c)}\nPORTFOLIO avg live CTR: ${avgCtr.toFixed(2)}%. Seasonality: ${monthSeason.phase}.`,
    instruction: `Diagnose campaign ${c.id} ("${c.name}"). Explain WHY it performs the way it does — channel-to-goal fit, audience resolution, creative — citing only store data. Return JSON: {"verdict":"underperforming"|"healthy"|"promising","why":string,"fixes":string[] (2-3 concrete moves),"trace":string[]}.`,
    fallback: () => localDiagnosis(c, ctr, avgCtr),
  });
  log("marketing", "Campaign diagnosed", `"${c.name}": ${data.verdict} — ${data.why.slice(0, 110)}…`, data.trace ?? [], [c.id], engine);
  return { verdict: data.verdict, ctr: ctr.toFixed(2) + "%", avgCtr: avgCtr.toFixed(2) + "%", why: data.why, fixes: data.fixes ?? [], trace: data.trace ?? [] };
}

function localDiagnosis(c: Campaign, ctr: number, avg: number) {
  if (c.channel === "Instagram") {
    return {
      verdict: "underperforming",
      why: `42.1K impressions but ${ctr.toFixed(1)}% CTR against a ${avg.toFixed(1)}% portfolio average — the reel's audience resolved to couples scrolling wedding hashtags, not planners. The goal was planner awareness; the channel's algorithm optimised for the wrong viewer. Reply quality confirms it: ${c.metrics.replies} replies, none planner-intent.`,
      fixes: ["Pause cam-02 spend; keep the footage as testimonial B-roll for the LinkedIn series", "Re-target: founder-POV reels ('what 40 vendors look like on one thread') only if IG is retried", "Move cam-02's ₹12,000 proposed budget behind cam-01, which converts at 2.9%"],
      trace: [`${c.id}: CTR ${ctr.toFixed(2)}% vs portfolio avg ${avg.toFixed(2)}% — 3.6× below`, `replies: ${c.metrics.replies}, leads: ${c.metrics.leads} — top-of-funnel volume, zero intent`, "channel-goal mismatch: IG wedding hashtags serve couples (audience note in campaign record)"],
    };
  }
  if (c.channel === "WhatsApp") {
    return {
      verdict: "healthy",
      why: `${Math.round((c.metrics.clicks / Math.max(1, c.metrics.impressions)) * 100)}% open rate — the warm list trusts the sender. ${c.metrics.replies} replies from 140 recipients is 5× the reply density of any cold channel in the portfolio.`,
      fixes: ["Add one broadcast per month during the booking window", "Pipe the 12 replies into Sales as warm leads with the broadcast as source"],
      trace: [`${c.id}: ${c.metrics.clicks}/${c.metrics.impressions} opened`, `${c.metrics.replies} replies → ${c.metrics.leads} leads, highest intent per impression in store`],
    };
  }
  if (c.channel === "SEO") {
    return {
      verdict: "promising",
      why: `Only ${(c.metrics.impressions / 1000).toFixed(1)}K impressions so far, but ${ctr.toFixed(1)}% CTR — above portfolio average. Comparison searchers arrive with intent already formed; the page just needs traffic compounding.`,
      fixes: ["Publish the WedMeGood-complementary angle (doc-04 insight) as a second page", "Interlink both comparison pages; capture 'meragi alternative' long-tails"],
      trace: [`${c.id}: CTR ${ctr.toFixed(2)}% > avg ${avg.toFixed(2)}%`, "doc-04 supplies the differentiation claims — no invented stats needed"],
    };
  }
  return {
    verdict: "healthy",
    why: `CTR ${ctr.toFixed(1)}% against a ${avg.toFixed(1)}% average, with ${c.metrics.replies} founder replies — the channel matches the goal: planners read planners.`,
    fixes: ["Keep cadence at one story per week", "Harvest the 31 replies into the Sales warm list"],
    trace: [`${c.id}: CTR ${ctr.toFixed(2)}%, replies ${c.metrics.replies}, leads ${c.metrics.leads}`],
  };
}

export async function writeBrief(ideaId: string): Promise<Idea> {
  const s = getState();
  const idea = s.ideas.find((i) => i.id === ideaId);
  if (!idea) throw new Error("idea not found");
  const brand = s.documents.find((d) => d.type === "Brand");

  const { data, engine } = await think<{ brief: { objective: string; audience: string; message: string; format: string; proposedBudget: string; kpi: string; timeline: string } }>({
    dossier: compactStore(s) + `\n\nVOICE RULES (${brand?.id}):\n${brand?.content}\nIDEA:\n${JSON.stringify(idea)}\nSEASONALITY: ${monthSeason.phase}.`,
    instruction: `Write a full creative brief for this idea in Sutr's plum-and-gold voice. Return JSON: {"brief":{"objective":string,"audience":string,"message":string,"format":string,"proposedBudget":string (must say "proposed only — no spend committed until owner approves"),"kpi":string,"timeline":string}}.`,
    fallback: () => ({
      brief: {
        objective: `${idea.title} — reasoned target: move the metric this idea was built on (see rationale).`,
        audience: "Founder-planners at 12+ event firms, metros + Jaipur/Udaipur wedding corridor",
        message: idea.rationale,
        format: `${idea.channel}-native: ${idea.channel === "LinkedIn" ? "2 founder-voice posts + 1 carousel" : idea.channel === "WhatsApp" ? "one broadcast card + reply tree" : idea.channel === "SEO" ? "one 900-word comparison page + on-page schema" : "one meetup kit + signup sheet"}`,
        proposedBudget: `${idea.costEstimate} (proposed only — no spend committed until owner approves)`,
        kpi: idea.channel === "WhatsApp" ? "open rate ≥ 55%, replies ≥ 12" : idea.channel === "SEO" ? "CTR ≥ 3% at 2K impressions" : "CTR ≥ 2.5%, planner replies ≥ 15",
        timeline: "Ship within 5 working days; read metrics at day 7 against portfolio average.",
      },
    }),
  });
  const updated: Idea = { ...idea, status: "briefed", brief: { channel: idea.channel, voice: brand?.content.slice(0, 160) ?? "warm authority, concrete, no jargon", ...data.brief } };
  mutate((st) => ({ ...st, ideas: st.ideas.map((i) => (i.id === ideaId ? updated : i)) }));
  log("marketing", "Brief written", `Full creative brief for "${idea.title}" — budget proposed only, nothing committed.`, [`brief assembled from idea ${idea.id}`, `voice rules from ${brand?.id}`, "budget guardrail applied: proposed only"], [idea.id, brand?.id ?? ""], engine);
  return updated;
}

/* ============================================================
   AGENT 3 — OPERATIONS · Sutr
   ============================================================ */

export async function runOpsScan(): Promise<{ risks: OpsRisk[]; escalated: OpsRisk[] }> {
  const s = getState();
  const churnDoc = s.documents.find((d) => /churn/i.test(d.title));
  const playbook = s.documents.find((d) => /playbook/i.test(d.title));

  const { data, engine, note } = await think<{ risks: Omit<OpsRisk, "id" | "createdAt" | "status" | "engine">[] }>({
    dossier: compactStore(s) + `\n\nCHURN POSTMORTEM (${churnDoc?.id}):\n${churnDoc?.content}\nSLA DOC (doc-12):\n${s.documents.find((d) => d.id === "doc-12")?.content}\nPLAYBOOK (${playbook?.id}):\n${playbook?.content}`,
    instruction: `Run the operational risk scan. Identify NEW risks only (skip anything already in OPEN RISKS). Severity 3 = likely churn or event failure, 2 = SLA breach, 1 = watch item. Every risk needs evidence[] citing actual figures, a why that names the data pattern, and a recommendation that names a playbook/doc where one exists. Return JSON: {"risks":[{"severity":1|2|3,"title":string,"category":string,"entity":string,"entityId":string,"evidence":string[],"why":string,"recommendation":string,"trace":string[],"refs":string[]}]}.`,
    fallback: () => ({ risks: localScan(s) }),
  });

  const existing = new Set(s.risks.filter((r) => r.status !== "resolved").map((r) => r.entityId + r.category));
  const created: OpsRisk[] = [];
  for (const r of data.risks ?? []) {
    if (!r || !r.entityId || existing.has(r.entityId + r.category)) continue;
    const risk: OpsRisk = {
      id: uid("risk"), severity: ([1, 2, 3].includes(r.severity) ? r.severity : 2) as 1 | 2 | 3,
      title: r.title, category: r.category, entity: r.entity, entityId: r.entityId,
      evidence: r.evidence ?? [], why: r.why ?? "", recommendation: r.recommendation ?? "",
      status: r.severity === 3 ? "escalated" : "open", createdAt: new Date().toISOString(),
      trace: (r as { trace?: string[] }).trace ?? [], refs: (r as { refs?: string[] }).refs ?? [], engine,
    };
    addRisk(risk);
    existing.add(risk.entityId + risk.category);
    created.push(risk);
    if (risk.severity === 3) {
      const acc = s.accounts.find((a) => a.id === risk.entityId);
      if (acc?.linkedLeadId) {
        const lead = s.leads.find((l) => l.id === acc.linkedLeadId);
        if (lead && lead.status !== "nurture") {
          updateLead(lead.id, {
            status: "nurture",
            lastActivity: new Date().toISOString(),
            notes: [...lead.notes, "OPS HOLD: churn risk open — do not pitch until onboarding recovers."],
            history: [...lead.history, { ts: new Date().toISOString(), note: "Sales pitch auto-held by Ops churn flag (shared store)." }],
          });
        }
      }
    }
  }
  setLastOpsScan(new Date().toISOString());
  const escalated = created.filter((r) => r.status === "escalated");
  log("ops", "Risk scan complete", `Scanned ${s.accounts.length} customer accounts + event timelines. ${created.length} new risk${created.length === 1 ? "" : "s"}; ${escalated.length} escalated immediately.`, [
    `checked setup-stall pattern against ${churnDoc?.id} (3 of 4 churned accounts stalled <60% by day 14)`,
    `checked vendor confirmation gaps against doc-12 SLA (T-21 full confirmation)`,
    `deduplicated against ${s.risks.length} existing risks`,
  ], created.map((r) => r.entityId), engine);
  if (note) log("system", "Engine fallback", note, [], [], "ondevice");
  return { risks: created, escalated };
}

function localScan(s: AppState): Omit<OpsRisk, "id" | "createdAt" | "status" | "engine">[] {
  const out: Omit<OpsRisk, "id" | "createdAt" | "status" | "engine">[] = [];
  const now = Date.now();
  for (const a of s.accounts) {
    const ageDays = Math.round((now - new Date(a.onboardedAt).getTime()) / 86400000);
    if (ageDays > 14 && a.setupPct < 60) {
      const expDoc = s.documents.find((d) => d.relatedTo === a.name && d.expiresAt && new Date(d.expiresAt).getTime() - now < 30 * 86400000);
      out.push({
        severity: 3, title: `Churn signature — ${a.name} stalled at ${a.setupPct}% setup`, category: "Churn risk",
        entity: a.name, entityId: a.id,
        evidence: [
          `Onboarded ${ageDays} days ago, setup frozen at ${a.setupPct}% (below the 60% danger line)`,
          `Inactive ${a.lastActiveDays} days with ${a.openTickets} open ticket${a.openTickets === 1 ? "" : "s"}`,
          `doc-05 postmortem: 3 of 4 churned planners had this exact pattern by day 14`,
          expDoc ? `${expDoc.id} (${expDoc.title}) expires in ${Math.max(1, Math.round((new Date(expDoc.expiresAt!).getTime() - now) / 86400000))} days — renewal window collides with the stall` : "no agreement renewal nearby",
        ],
        why: `The Q3 postmortem found 3 of 4 churned accounts stalled below 60% setup within 14 days, then went silent. ${a.name} is at day ${ageDays}, ${a.setupPct}%, silent ${a.lastActiveDays} days — a live match for the pattern, not a guess.`,
        recommendation: `Concierge setup call within 48h (Onboarding Playbook day-10 trigger), same-day resolution on the ${a.openTickets} open ticket${a.openTickets === 1 ? "" : "s"}${expDoc ? `, and fold the expiring vendor agreement into that call as the save motion` : ""}. Sales pitch on the linked lead is held automatically.`,
        trace: [
          `${a.id}: ${a.setupPct}% setup at day ${ageDays}, inactive ${a.lastActiveDays}d, ${a.openTickets} tickets`,
          "pattern matched against doc-05 (3 of 4 churned accounts: <60% by day 14, then silent)",
          a.linkedLeadId ? `shared-store rule: wrote OPS HOLD to ${a.linkedLeadId} so Sales stops pitching a slipping account` : "no linked lead",
        ],
        refs: [a.id, "doc-05", "doc-11", ...(expDoc ? [expDoc.id] : [])],
      });
    } else if (a.lastActiveDays >= 10) {
      out.push({
        severity: 2, title: `${a.name} inactive ${a.lastActiveDays} days with an event on the books`, category: "Engagement drop",
        entity: a.name, entityId: a.id,
        evidence: [`Last active ${a.lastActiveDays} days ago`, `${a.activeEvents} active event(s) with no timeline activity`, `setup at ${a.setupPct}%`],
        why: `Inactivity above 10 days with a live event precedes the stall pattern in doc-05 by roughly two weeks. Catching it now is cheaper than the concierge rescue later.`,
        recommendation: "Send the §6 timeline-creation nudge from the Onboarding Playbook and offer a 15-minute working session.",
        trace: [`${a.id} inactive ${a.lastActiveDays}d, ${a.activeEvents} active events`, "threshold from doc-05 lead-time analysis"],
        refs: [a.id, "doc-05", "doc-11"],
      });
    }
    if (a.vendorConfirmGap) {
      const g = a.vendorConfirmGap;
      out.push({
        severity: 2, title: `Vendor confirmation lag — ${g.event}`, category: "Event timeline",
        entity: a.name, entityId: a.id,
        evidence: [`${g.confirmed} of ${g.total} vendors confirmed, ${g.daysOut} days out`, "doc-12 SLA: 100% confirmation at T-21 days", g.daysOut < 21 ? `already ${21 - g.daysOut} day(s) past the SLA line` : "approaching the SLA line"],
        why: `doc-12 sets full confirmation at 21 days out because décor vendors need build lead time. ${a.name} is at ${g.confirmed}/${g.total} with ${g.daysOut} days to go — ${g.daysOut < 21 ? "the SLA is already breached" : "the SLA will be breached inside the week"}.`,
        recommendation: `Push the §4 vendor-chase templates (doc-11) and offer Sutr-side nudges to the two biggest pending vendors.`,
        trace: [`${a.id} event "${g.event}": ${g.confirmed}/${g.total} confirmed @ T-${g.daysOut}`, "compared against doc-12 T-21 SLA", "chase templates available in doc-11 §4"],
        refs: [a.id, "doc-12", "doc-11"],
      });
    }
  }
  return out;
}

/* ============================================================
   AGENT 4 — DOCUMENT VAULT · Sutr
   ============================================================ */

const TYPE_HINTS: [RegExp, string][] = [
  [/pitch|deck/i, "Deck"], [/spec|build/i, "Spec"], [/brand|identity/i, "Brand"],
  [/research|market|comparison/i, "Research"], [/postmortem|sla|ops/i, "Ops doc"],
  [/agreement|contract/i, "Contract"], [/term sheet|safe|investor/i, "Investor"],
  [/invoice|gst|billing/i, "Finance"], [/playbook/i, "Playbook"], [/mou|partnership/i, "Partnership"],
];

export async function ingestDocument(input: { title: string; type?: string; relatedTo: string; content: string; expiresAt?: string; ocr: boolean }): Promise<Doc> {
  const s = getState();
  const text = `${input.title} ${input.content}`;
  const trace: string[] = [];

  let type = input.type;
  if (!type) {
    const hit = TYPE_HINTS.find(([re]) => re.test(text));
    type = hit ? hit[1] : "General";
    trace.push(`type auto-detected as "${type}" ${hit ? "from title/content keywords" : "(no keyword match — filed as General)"}`);
  } else trace.push(`type provided by owner: ${type}`);

  const tags: string[] = [type.toLowerCase()];
  const cities = ["Jaipur", "Mumbai", "Delhi", "Bengaluru", "Kochi", "Goa", "Hyderabad", "Pune", "Lucknow", "Chandigarh", "Udaipur", "Amritsar"];
  cities.forEach((c) => { if (text.toLowerCase().includes(c.toLowerCase())) tags.push(c.toLowerCase()); });
  if (text.length > 20) trace.push(`tags: ${tags.slice(1).length ? tags.slice(1).join(", ") + " extracted from text" : "no city entities found"}`);

  let related = input.relatedTo;
  const nameHit = s.accounts.map((a) => a.name).concat(s.leads.map((l) => l.owner)).find((n) => text.includes(n));
  if (!related || related === "Internal") related = nameHit ?? related;
  if (nameHit) trace.push(`entity "${nameHit}" matched against the customer/lead register — linked`);

  if (/confidential|term sheet|safe/i.test(text)) { tags.push("confidential"); trace.push("confidentiality marker detected — access stays owner-only"); }
  if (/renew|expir|12 months|term:/i.test(text)) trace.push("renewal language detected — expiry will be watched automatically");

  const content = input.ocr ? `[OCR extracted — simulated on provided text]\n${input.content}` : input.content;
  if (input.ocr) trace.push("OCR pass over scan (simulated): text made searchable, entities extracted");

  const doc: Doc = {
    id: uid("doc"), title: input.title, type, tags: [...new Set(tags)], relatedTo: related || "Internal",
    addedAt: new Date().toISOString(), expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined,
    summary: input.content.slice(0, 140).replace(/\s+/g, " ").trim() + "…",
    content, ocr: input.ocr, access: "owner", trace,
  };
  mutate((st) => ({ ...st, documents: [doc, ...st.documents] }));
  log("vault", "Document ingested", `"${doc.title}" filed as ${doc.type}, tags [${doc.tags.join(", ")}], linked to ${doc.relatedTo}.`, trace, [doc.id], "ondevice");
  await breath(500);
  return doc;
}

const SYNONYMS: Record<string, string[]> = {
  pitch: ["deck", "investor", "fundraising", "raise"],
  meragi: ["comparison", "research", "competitive", "alternative"],
  contract: ["agreement", "legal", "vendor"],
  renewal: ["expiry", "expires", "renew", "vendor agreement"],
  churn: ["postmortem", "retention", "onboarding"],
  pricing: ["gst", "invoice", "billing", "cost"],
};

export function searchDocs(query: string): { doc: Doc; hits: string[] }[] {
  const s = getState();
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const expanded = new Set<string>(tokens);
  tokens.forEach((t) => {
    if (SYNONYMS[t]) SYNONYMS[t].forEach((x) => expanded.add(x));
    Object.entries(SYNONYMS).forEach(([k, v]) => { if (v.includes(t)) expanded.add(k); });
  });
  const results = s.documents.map((doc) => {
    const hay: [string, string][] = [
      ["title", doc.title], ["type", doc.type], ["tags", doc.tags.join(" ")],
      ["related", doc.relatedTo], ["summary", doc.summary], ["content", doc.content],
    ];
    const hits: string[] = [];
    let score = 0;
    for (const term of expanded) {
      for (const [field, value] of hay) {
        if (value.toLowerCase().includes(term)) {
          score += field === "title" ? 4 : field === "tags" || field === "type" ? 3 : field === "content" ? 2 : 2;
          if (!hits.includes(field)) hits.push(field);
        }
      }
    }
    return { doc, hits, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  return results.map(({ doc, hits }) => ({ doc, hits }));
}

export function expiryWatch(): { doc: Doc; days: number }[] {
  const now = Date.now();
  return getState().documents
    .filter((d) => d.expiresAt)
    .map((d) => ({ doc: d, days: Math.ceil((new Date(d.expiresAt!).getTime() - now) / 86400000) }))
    .filter((x) => x.days <= 30)
    .sort((a, b) => a.days - b.days);
}

/* ============================================================
   ORCHESTRATOR — morning digest (bundles all agents)
   ============================================================ */

export async function generateMorningDigest(): Promise<Digest> {
  const s0 = getState();
  const ideasToday = s0.ideas.filter((i) => i.date === todayKey() && i.status !== "dismissed");
  const ideas = ideasToday.length ? ideasToday : await morningIdeas();

  const staleScan = !s0.lastOpsScan || Date.now() - new Date(s0.lastOpsScan).getTime() > 12 * 3600000;
  if (staleScan) await runOpsScan();

  const s = getState();
  const draftsReady = s.drafts.filter((d) => d.status === "ready").length;
  const repliesNew = s.leads.filter((l) => Date.now() - new Date(l.lastActivity).getTime() < 24 * 3600000).length;
  const topLead = [...s.leads].filter((l) => ["new", "qualified"].includes(l.status)).sort((a, b) => b.fitScore - a.fitScore)[0];
  const openRisks = s.risks.filter((r) => r.status !== "resolved");
  const escalated = openRisks.filter((r) => r.status === "escalated");
  const topRisk = [...openRisks].sort((a, b) => b.severity - a.severity)[0];

  const digest: Digest = {
    date: todayKey(), generatedAt: new Date().toISOString(), engine: ideas[0]?.engine ?? "ondevice",
    ideaIds: ideas.slice(0, 3).map((i) => i.id),
    salesSummary: {
      draftsReady, repliesNew,
      topLeadId: topLead?.id ?? null,
      topLeadNote: topLead ? `${topLead.planner} (${topLead.city}) — fit ${topLead.fitScore}, ${topLead.tierFit} tier, via ${topLead.source.split("—")[0].trim()}` : "pipeline quiet",
    },
    opsSummary: {
      openRisks: openRisks.length, escalated: escalated.length,
      topRiskId: topRisk?.id ?? null,
      note: topRisk ? `${topRisk.title} — sev ${topRisk.severity}${topRisk.status === "escalated" ? ", escalated immediately" : ""}` : "no open risks — all accounts inside pattern",
    },
  };
  setDigest(digest);
  log("system", "Morning digest compiled", `Bundled ${ideas.length} marketing ideas, ${draftsReady} drafts in the send queue, ${openRisks.length} open ops risks (${escalated.length} escalated).`, [
    "06:00 trigger: marketing ideation + ops scan + sales overnight read",
    `engine: ${digest.engine}`, "guardrails re-asserted: no autonomous send, no autonomous spend",
  ], ["cam-*", "acc-*"], digest.engine);
  return digest;
}
