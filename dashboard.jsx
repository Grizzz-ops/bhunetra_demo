import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  AreaChart,
  Area,
} from "recharts";
import {
  AlertTriangle,
  MapPin,
  Clock,
  FileText,
  Users,
  ShieldCheck,
  ChevronRight,
  Search,
  Activity,
  Radio,
  Lock,
  ArrowUpRight,
  CheckCircle2,
  LayoutGrid,
  Building2,
  Signal,
  X,
  Info,
  Bell,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Reference "now" — keeps SLA math deterministic for the demo         */
/* ------------------------------------------------------------------ */
const NOW = new Date("2026-08-21T09:00:00Z");

/* ------------------------------------------------------------------ */
/* Mock data — clearly-labelled simulated detections, not real sites   */
/* ------------------------------------------------------------------ */
const STAGES = ["Field Officer", "DMG", "IBM HQ"];

const ALERTS = [
  { id: "BN-2601", region: "Keonjhar Belt", state: "Odisha", x: 63, y: 40, risk: 92, sar: 71, lights: 58, vehicle: 66, detected: "2026-08-17T05:10:00Z", deadline: "2026-08-20T05:10:00Z", status: "escalated", stage: 2, officer: "R. Nair", note: "Extraction footprint 340m beyond lease boundary, confirmed across two SAR passes." },
  { id: "BN-2599", region: "Sundargarh Rim", state: "Odisha", x: 60, y: 34, risk: 84, sar: 62, lights: 49, vehicle: 71, detected: "2026-08-18T03:40:00Z", deadline: "2026-08-21T15:40:00Z", status: "verifying", stage: 1, officer: "R. Nair", note: "Night-lights delta rising over three consecutive scans; field visit pending." },
  { id: "BN-2588", region: "Bokaro Fringe", state: "Jharkhand", x: 66, y: 30, risk: 77, sar: 55, lights: 40, vehicle: 62, detected: "2026-08-16T22:05:00Z", deadline: "2026-08-19T22:05:00Z", status: "escalated", stage: 2, officer: "S. Toppo", note: "SLA breached at Field Officer stage; auto-escalated to DMG then IBM HQ." },
  { id: "BN-2612", region: "Raigarh Corridor", state: "Chhattisgarh", x: 55, y: 46, risk: 68, sar: 48, lights: 33, vehicle: 55, detected: "2026-08-19T09:20:00Z", deadline: "2026-08-22T09:20:00Z", status: "new", stage: 0, officer: "Unassigned", note: "First detection. Awaiting field-officer acknowledgement." },
  { id: "BN-2609", region: "Bellary Ridge", state: "Karnataka", x: 47, y: 62, risk: 61, sar: 41, lights: 29, vehicle: 47, detected: "2026-08-19T14:55:00Z", deadline: "2026-08-22T14:55:00Z", status: "verifying", stage: 1, officer: "K. Hegde", note: "Vehicle-density proxy up 3x on unlisted access track." },
  { id: "BN-2615", region: "Udaipur Flats", state: "Rajasthan", x: 34, y: 34, risk: 54, sar: 36, lights: 22, vehicle: 44, detected: "2026-08-20T02:15:00Z", deadline: "2026-08-23T02:15:00Z", status: "new", stage: 0, officer: "Unassigned", note: "Moderate SAR change near an inactive quarry boundary." },
  { id: "BN-2591", region: "Balaghat Hollow", state: "Madhya Pradesh", x: 48, y: 42, risk: 45, sar: 27, lights: 18, vehicle: 33, detected: "2026-08-18T11:30:00Z", deadline: "2026-08-21T11:30:00Z", status: "verifying", stage: 1, officer: "A. Deshmukh", note: "Low-confidence trigger; scheduled for routine overflight confirmation." },
  { id: "BN-2620", region: "Adilabad Verge", state: "Telangana", x: 51, y: 55, risk: 38, sar: 21, lights: 12, vehicle: 29, detected: "2026-08-20T19:00:00Z", deadline: "2026-08-23T19:00:00Z", status: "new", stage: 0, officer: "Unassigned", note: "Within seasonal variance; flagged for monitoring only." },
  { id: "BN-2555", region: "North Goa Coast", state: "Goa", x: 40, y: 63, risk: 22, sar: 14, lights: 8, vehicle: 15, detected: "2026-08-14T08:00:00Z", deadline: "2026-08-17T08:00:00Z", status: "resolved", stage: 2, officer: "P. Fernandes", note: "Verified as licensed seasonal dredging. Case closed with field report." },
];

const OFFICERS = [
  { name: "R. Nair", role: "Field Officer", station: "Odisha Circle", active: 2, resolved: 14, avgHrs: 19 },
  { name: "S. Toppo", role: "Field Officer", station: "Jharkhand Circle", active: 1, resolved: 9, avgHrs: 27 },
  { name: "K. Hegde", role: "Field Officer", station: "Karnataka Circle", active: 1, resolved: 11, avgHrs: 21 },
  { name: "A. Deshmukh", role: "Field Officer", station: "MP Circle", active: 1, resolved: 6, avgHrs: 24 },
  { name: "P. Fernandes", role: "Field Officer", station: "Goa Circle", active: 0, resolved: 8, avgHrs: 16 },
  { name: "M. Iyer", role: "DMG Reviewer", station: "State DMG Office", active: 3, resolved: 22, avgHrs: 12 },
  { name: "V. Chandran", role: "IBM HQ Reviewer", station: "IBM Headquarters", active: 1, resolved: 5, avgHrs: 30 },
];

const LEDGER = [
  { ts: "2026-08-21T08:40:00Z", actor: "System", action: "SAR pass ingested for Raigarh Corridor sector", caseId: "BN-2612", type: "detection" },
  { ts: "2026-08-21T07:55:00Z", actor: "V. Chandran (IBM HQ)", action: "Acknowledged escalation and requested drone confirmation", caseId: "BN-2601", type: "escalation" },
  { ts: "2026-08-21T06:20:00Z", actor: "System", action: "SLA breached at DMG stage — auto-escalated to IBM HQ", caseId: "BN-2601", type: "system" },
  { ts: "2026-08-20T22:10:00Z", actor: "M. Iyer (DMG)", action: "Flagged inconsistent field report, returned for re-verification", caseId: "BN-2588", type: "officer_action" },
  { ts: "2026-08-20T19:00:00Z", actor: "System", action: "New trigger scored and queued: Adilabad Verge", caseId: "BN-2620", type: "detection" },
  { ts: "2026-08-20T14:05:00Z", actor: "K. Hegde (Field Officer)", action: "Logged site visit, vehicle activity corroborated", caseId: "BN-2609", type: "officer_action" },
  { ts: "2026-08-20T02:15:00Z", actor: "System", action: "New trigger scored and queued: Udaipur Flats", caseId: "BN-2615", type: "detection" },
  { ts: "2026-08-19T22:05:00Z", actor: "System", action: "SLA deadline reached with no officer action — auto-escalated", caseId: "BN-2588", type: "system" },
  { ts: "2026-08-19T14:55:00Z", actor: "System", action: "New trigger scored and queued: Bellary Ridge", caseId: "BN-2609", type: "detection" },
  { ts: "2026-08-18T11:30:00Z", actor: "System", action: "New trigger scored and queued: Balaghat Hollow", caseId: "BN-2591", type: "detection" },
  { ts: "2026-08-17T09:15:00Z", actor: "R. Nair (Field Officer)", action: "Uploaded photographic evidence, boundary overshoot confirmed", caseId: "BN-2601", type: "officer_action" },
  { ts: "2026-08-14T08:00:00Z", actor: "P. Fernandes (Field Officer)", action: "Case closed — licensed seasonal dredging confirmed", caseId: "BN-2555", type: "resolution" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
function tierOf(risk) {
  if (risk >= 80) return "high";
  if (risk >= 50) return "medium";
  return "low";
}
const TIER_LABEL = { high: "High risk", medium: "Medium risk", low: "Low risk" };

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function hoursBetween(a, b) {
  return (new Date(b) - new Date(a)) / 36e5;
}

function slaInfo(alert) {
  if (alert.status === "resolved") return { pct: 100, breached: false, label: "Closed" };
  const total = hoursBetween(alert.detected, alert.deadline);
  const elapsed = hoursBetween(alert.detected, NOW.toISOString());
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const breached = NOW > new Date(alert.deadline);
  const remainingHrs = Math.round(hoursBetween(NOW.toISOString(), alert.deadline));
  return { pct, breached, remainingHrs, label: breached ? "SLA breached" : `${remainingHrs}h to deadline` };
}

const LEDGER_ICON = {
  detection: Radio,
  verification: Search,
  escalation: ArrowUpRight,
  officer_action: ShieldCheck,
  resolution: CheckCircle2,
  system: Lock,
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                                */
/* ------------------------------------------------------------------ */
function RiskDot({ tier, size = 8 }) {
  return <span className={`bhu-dot bhu-dot-${tier}`} style={{ width: size, height: size }} />;
}

function RiskBadge({ risk }) {
  const tier = tierOf(risk);
  return (
    <span className={`bhu-badge bhu-badge-${tier}`}>
      <RiskDot tier={tier} />
      {risk}
      <span className="bhu-badge-label">{TIER_LABEL[tier]}</span>
    </span>
  );
}

function SlaBar({ alert }) {
  const s = slaInfo(alert);
  const barClass = alert.status === "resolved" ? "bhu-sla-fill-done" : s.breached ? "bhu-sla-fill-breach" : s.pct > 70 ? "bhu-sla-fill-warn" : "bhu-sla-fill-ok";
  return (
    <div>
      <div className="bhu-sla-track">
        <div className={`bhu-sla-fill ${barClass}`} style={{ width: `${s.pct}%` }} />
      </div>
      <div className={`bhu-sla-label ${s.breached && alert.status !== "resolved" ? "bhu-text-breach" : ""}`}>
        {s.label}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend, icon: Icon }) {
  return (
    <div className="bhu-kpi">
      <div className="bhu-kpi-top">
        <div>
          <div className="bhu-kpi-label">{label}</div>
          <div className="bhu-kpi-value">{value}</div>
          {sub && <div className="bhu-kpi-sub">{sub}</div>}
        </div>
        <div className="bhu-kpi-icon"><Icon size={16} /></div>
      </div>
      {trend && (
        <div className="bhu-kpi-trend">
          <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={trend.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`trend-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4FD8C4" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#4FD8C4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#4FD8C4" strokeWidth={1.5} fill={`url(#trend-${label})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EscalationStepper({ stage }) {
  return (
    <div className="bhu-stepper">
      {STAGES.map((s, i) => (
        <div key={s} className="bhu-step">
          <div className={`bhu-step-dot ${i <= stage ? "bhu-step-dot-active" : ""} ${i === stage ? "bhu-step-dot-current" : ""}`}>
            {i < stage ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          <div className={`bhu-step-label ${i <= stage ? "bhu-step-label-active" : ""}`}>{s}</div>
          {i < STAGES.length - 1 && <div className={`bhu-step-line ${i < stage ? "bhu-step-line-active" : ""}`} />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Map panel                                                            */
/* ------------------------------------------------------------------ */
function CoverageMap({ alerts, selectedId, onSelect }) {
  return (
    <div className="bhu-map">
      <div className="bhu-map-grid" aria-hidden="true" />
      <svg className="bhu-map-contours" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,70 Q25,55 50,66 T100,58" />
        <path d="M0,50 Q30,38 55,48 T100,40" />
        <path d="M0,30 Q20,20 45,28 T100,22" />
        <path d="M0,85 Q35,74 60,82 T100,76" />
      </svg>
      <div className="bhu-map-sweep-wrap motion-safe:animate-none" aria-hidden="true">
        <div className="bhu-map-sweep" />
      </div>
      <div className="bhu-map-rings" aria-hidden="true">
        <span className="bhu-ring bhu-ring-1" />
        <span className="bhu-ring bhu-ring-2" />
        <span className="bhu-ring bhu-ring-3" />
      </div>

      {alerts.map((a) => {
        const tier = tierOf(a.risk);
        const active = a.id === selectedId;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`bhu-marker bhu-marker-${tier} ${active ? "bhu-marker-active" : ""}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            aria-label={`${a.region}, ${a.state} — risk score ${a.risk}`}
            title={`${a.region}, ${a.state} — risk ${a.risk}`}
          >
            {tier === "high" && <span className="bhu-marker-pulse" />}
            <span className="bhu-marker-core" />
          </button>
        );
      })}

      <div className="bhu-map-legend">
        <span><RiskDot tier="high" /> High</span>
        <span><RiskDot tier="medium" /> Medium</span>
        <span><RiskDot tier="low" /> Low</span>
      </div>
      <div className="bhu-map-caption">
        <Signal size={12} /> Regional coverage grid · SAR + optical fusion · simulated positions
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alert detail drawer                                                  */
/* ------------------------------------------------------------------ */
function DetailDrawer({ alert, onClose }) {
  if (!alert) return null;
  const tier = tierOf(alert.risk);
  const gaugeData = [{ name: "risk", value: alert.risk, fill: tier === "high" ? "#F0453A" : tier === "medium" ? "#E8A23D" : "#4FAE73" }];

  return (
    <div className="bhu-drawer-overlay" onClick={onClose}>
      <div className="bhu-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Case ${alert.id} detail`}>
        <div className="bhu-drawer-head">
          <div>
            <div className="bhu-mono bhu-drawer-id">{alert.id}</div>
            <div className="bhu-drawer-title">{alert.region}</div>
            <div className="bhu-drawer-sub"><MapPin size={12} /> {alert.state}</div>
          </div>
          <button className="bhu-icon-btn" onClick={onClose} aria-label="Close detail panel"><X size={16} /></button>
        </div>

        <div className="bhu-drawer-gauge">
          <ResponsiveContainer width={120} height={120}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: "#1B2C24" }} dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="bhu-drawer-gauge-num">
            <div className="bhu-drawer-gauge-value">{alert.risk}</div>
            <div className="bhu-drawer-gauge-label">Risk score</div>
          </div>
        </div>

        <p className="bhu-drawer-note">{alert.note}</p>

        <div className="bhu-drawer-section-label">Verification signals</div>
        <div className="bhu-signal-row">
          <span className="bhu-signal-name">SAR change</span>
          <div className="bhu-signal-track"><div className="bhu-signal-fill bhu-signal-sar" style={{ width: `${alert.sar}%` }} /></div>
          <span className="bhu-mono bhu-signal-val">{alert.sar}%</span>
        </div>
        <div className="bhu-signal-row">
          <span className="bhu-signal-name">Night-lights Δ</span>
          <div className="bhu-signal-track"><div className="bhu-signal-fill bhu-signal-lights" style={{ width: `${alert.lights}%` }} /></div>
          <span className="bhu-mono bhu-signal-val">{alert.lights}%</span>
        </div>
        <div className="bhu-signal-row">
          <span className="bhu-signal-name">Vehicle activity</span>
          <div className="bhu-signal-track"><div className="bhu-signal-fill bhu-signal-vehicle" style={{ width: `${alert.vehicle}%` }} /></div>
          <span className="bhu-mono bhu-signal-val">{alert.vehicle}%</span>
        </div>

        <div className="bhu-drawer-section-label">Escalation status</div>
        <EscalationStepper stage={alert.stage} />
        <SlaBar alert={alert} />

        <div className="bhu-drawer-meta">
          <div><span className="bhu-drawer-meta-key">Assigned officer</span><span className="bhu-mono">{alert.officer}</span></div>
          <div><span className="bhu-drawer-meta-key">First detected</span><span className="bhu-mono">{fmtTime(alert.detected)} IST</span></div>
        </div>

        <div className="bhu-drawer-actions">
          <button className="bhu-btn bhu-btn-primary">Mark verified</button>
          <button className="bhu-btn bhu-btn-ghost">Escalate now</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                  */
/* ------------------------------------------------------------------ */
function OverviewTab({ alerts, selectedId, setSelectedId, stats }) {
  const queue = useMemo(() => [...alerts].sort((a, b) => b.risk - a.risk).slice(0, 6), [alerts]);
  return (
    <>
      <div className="bhu-kpi-strip">
        <KpiCard label="Sites monitored" value={ALERTS.length} sub="active regional grid" icon={LayoutGrid} trend={[4, 5, 6, 7, 7, 8, 9]} />
        <KpiCard label="High-risk alerts" value={stats.high} sub="score ≥ 80" icon={AlertTriangle} trend={[1, 2, 2, 3, 2, 3, stats.high]} />
        <KpiCard label="Escalated cases" value={stats.escalated} sub="past field-officer SLA" icon={ArrowUpRight} trend={[0, 1, 1, 1, 2, 2, stats.escalated]} />
        <KpiCard label="Avg. verification" value="21h" sub="detection → field visit" icon={Clock} />
      </div>

      <div className="bhu-overview-grid">
        <div className="bhu-panel bhu-map-panel">
          <div className="bhu-panel-head">
            <h2 className="bhu-panel-title"><Activity size={14} /> Live coverage map</h2>
            <span className="bhu-live-pill"><span className="bhu-live-dot" /> Scanning</span>
          </div>
          <CoverageMap alerts={alerts} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="bhu-panel bhu-queue-panel">
          <div className="bhu-panel-head">
            <h2 className="bhu-panel-title"><Bell size={14} /> Priority queue</h2>
          </div>
          <div className="bhu-queue-list">
            {queue.map((a) => (
              <button key={a.id} className={`bhu-queue-item ${a.id === selectedId ? "bhu-queue-item-active" : ""}`} onClick={() => setSelectedId(a.id)}>
                <RiskDot tier={tierOf(a.risk)} size={9} />
                <div className="bhu-queue-item-body">
                  <div className="bhu-queue-item-top">
                    <span className="bhu-mono bhu-queue-item-id">{a.id}</span>
                    <span className="bhu-queue-item-score">{a.risk}</span>
                  </div>
                  <div className="bhu-queue-item-region">{a.region}, {a.state}</div>
                </div>
                <ChevronRight size={14} className="bhu-queue-item-chev" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bhu-panel bhu-ledger-preview">
        <div className="bhu-panel-head">
          <h2 className="bhu-panel-title"><Lock size={14} /> Append-only audit ledger</h2>
          <span className="bhu-panel-sub">latest entries, immutable</span>
        </div>
        <LedgerList entries={LEDGER.slice(0, 5)} compact />
      </div>
    </>
  );
}

function AlertsTab({ alerts, selectedId, setSelectedId, filter, setFilter, query, setQuery }) {
  const filtered = useMemo(() => {
    return alerts
      .filter((a) => (filter === "all" ? true : tierOf(a.risk) === filter))
      .filter((a) => (query ? (a.id + a.region + a.state).toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => b.risk - a.risk);
  }, [alerts, filter, query]);

  return (
    <div className="bhu-panel">
      <div className="bhu-panel-head bhu-alerts-head">
        <h2 className="bhu-panel-title"><AlertTriangle size={14} /> All alerts</h2>
        <div className="bhu-alerts-controls">
          <div className="bhu-search">
            <Search size={13} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search site ID or region" aria-label="Search alerts" />
          </div>
          <div className="bhu-filter-group" role="group" aria-label="Filter by risk tier">
            {["all", "high", "medium", "low"].map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`bhu-filter-btn ${filter === t ? "bhu-filter-btn-active" : ""}`}>
                {t === "all" ? "All" : TIER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bhu-table" role="table">
        <div className="bhu-table-row bhu-table-head" role="row">
          <span>Site</span><span>Region</span><span>Risk</span><span>Status</span><span>SLA</span><span>Officer</span>
        </div>
        {filtered.map((a) => (
          <button key={a.id} className={`bhu-table-row bhu-table-body ${a.id === selectedId ? "bhu-table-row-active" : ""}`} onClick={() => setSelectedId(a.id)} role="row">
            <span className="bhu-mono">{a.id}</span>
            <span>{a.region}<span className="bhu-table-state">{a.state}</span></span>
            <span><RiskBadge risk={a.risk} /></span>
            <span className={`bhu-status bhu-status-${a.status}`}>{a.status.replace("_", " ")}</span>
            <span className="bhu-table-sla"><SlaBar alert={a} /></span>
            <span>{a.officer}</span>
          </button>
        ))}
        {filtered.length === 0 && <div className="bhu-empty">No alerts match this filter.</div>}
      </div>
    </div>
  );
}

function CasesTab({ alerts, setSelectedId }) {
  const active = alerts.filter((a) => a.status !== "resolved").sort((a, b) => b.risk - a.risk);
  return (
    <div className="bhu-cases-grid">
      {active.map((a) => (
        <div key={a.id} className="bhu-panel bhu-case-card">
          <div className="bhu-case-top">
            <div>
              <div className="bhu-mono bhu-case-id">{a.id}</div>
              <div className="bhu-case-region">{a.region}, {a.state}</div>
            </div>
            <RiskBadge risk={a.risk} />
          </div>
          <EscalationStepper stage={a.stage} />
          <SlaBar alert={a} />
          <div className="bhu-case-foot">
            <span className="bhu-case-officer"><Users size={12} /> {a.officer}</span>
            <button className="bhu-btn bhu-btn-ghost bhu-btn-sm" onClick={() => setSelectedId(a.id)}>
              View case <ChevronRight size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerList({ entries, compact }) {
  return (
    <div className="bhu-ledger">
      {entries.map((e, i) => {
        const Icon = LEDGER_ICON[e.type] || Info;
        return (
          <div key={i} className={`bhu-ledger-item ${compact ? "bhu-ledger-item-compact" : ""}`}>
            <div className={`bhu-ledger-icon bhu-ledger-icon-${e.type}`}><Icon size={12} /></div>
            <div className="bhu-ledger-body">
              <div className="bhu-ledger-top">
                <span className="bhu-mono bhu-ledger-time">{fmtTime(e.ts)} IST</span>
                <span className="bhu-mono bhu-ledger-case">{e.caseId}</span>
              </div>
              <div className="bhu-ledger-action">
                <span className="bhu-ledger-actor">{e.actor}</span> — {e.action}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditTab() {
  return (
    <div className="bhu-panel">
      <div className="bhu-panel-head">
        <h2 className="bhu-panel-title"><Lock size={14} /> Full audit trail</h2>
        <span className="bhu-panel-sub">every action is timestamped and cannot be edited or deleted</span>
      </div>
      <LedgerList entries={LEDGER} />
    </div>
  );
}

function OfficersTab() {
  return (
    <div className="bhu-officers-grid">
      {OFFICERS.map((o) => (
        <div key={o.name} className="bhu-panel bhu-officer-card">
          <div className="bhu-officer-top">
            <div className="bhu-officer-avatar">{o.name.split(" ").map((p) => p[0]).join("")}</div>
            <div>
              <div className="bhu-officer-name">{o.name}</div>
              <div className="bhu-officer-role"><Building2 size={11} /> {o.role} · {o.station}</div>
            </div>
          </div>
          <div className="bhu-officer-stats">
            <div><span className="bhu-officer-stat-val">{o.active}</span><span className="bhu-officer-stat-label">Active</span></div>
            <div><span className="bhu-officer-stat-val">{o.resolved}</span><span className="bhu-officer-stat-label">Resolved</span></div>
            <div><span className="bhu-officer-stat-val">{o.avgHrs}h</span><span className="bhu-officer-stat-label">Avg. response</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App shell                                                            */
/* ------------------------------------------------------------------ */
const NAV = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "alerts", label: "Alerts", icon: AlertTriangle },
  { key: "cases", label: "Cases", icon: FileText },
  { key: "audit", label: "Audit log", icon: Lock },
  { key: "officers", label: "Officers", icon: Users },
];

export default function BhuNetraDashboard() {
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => ({
    high: ALERTS.filter((a) => a.risk >= 80 && a.status !== "resolved").length,
    escalated: ALERTS.filter((a) => a.status === "escalated").length,
  }), []);

  const selectedAlert = ALERTS.find((a) => a.id === selectedId) || null;

  return (
    <div className="bhu-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .bhu-root {
          --ink: #0A1512;
          --panel: #101E19;
          --panel-raised: #16281F;
          --border: #223529;
          --text: #EAF2ED;
          --muted: #8FA79B;
          --faint: #5E7268;
          --radar: #4FD8C4;
          --high: #F0453A;
          --high-soft: rgba(240,69,58,0.18);
          --med: #E8A23D;
          --med-soft: rgba(232,162,61,0.18);
          --low: #4FAE73;
          --low-soft: rgba(79,174,115,0.18);

          background: var(--ink);
          color: var(--text);
          font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
          min-height: 100vh;
          display: flex;
          font-size: 14px;
          line-height: 1.4;
        }
        .bhu-root * { box-sizing: border-box; }
        .bhu-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .bhu-root button { font-family: inherit; cursor: pointer; color: inherit; background: none; border: none; }
        .bhu-root button:focus-visible, .bhu-root input:focus-visible {
          outline: 2px solid var(--radar); outline-offset: 2px;
        }
        .bhu-root h1, .bhu-root h2, .bhu-root h3 { font-family: 'Space Grotesk', sans-serif; margin: 0; }

        /* ---- sidebar ---- */
        .bhu-sidebar {
          width: 208px; flex-shrink: 0; background: var(--panel);
          border-right: 1px solid var(--border); display: flex; flex-direction: column;
          padding: 20px 12px; gap: 4px;
        }
        .bhu-brand { padding: 0 8px 18px; }
        .bhu-brand-mark { display:flex; align-items:center; gap:8px; }
        .bhu-brand-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.02em; }
        .bhu-brand-sub { color: var(--muted); font-size: 11px; margin-top: 3px; }
        .bhu-nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px;
          color: var(--muted); font-size: 13px; font-weight: 500; text-align: left; width: 100%;
        }
        .bhu-nav-item:hover { background: var(--panel-raised); color: var(--text); }
        .bhu-nav-item-active { background: var(--panel-raised); color: var(--text); box-shadow: inset 2px 0 0 var(--radar); }
        .bhu-sidebar-foot { margin-top: auto; padding: 10px 8px 0; border-top: 1px solid var(--border); }
        .bhu-sim-badge {
          display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: var(--med);
          background: var(--med-soft); padding: 4px 7px; border-radius: 5px; margin-bottom: 8px; font-weight: 600;
          letter-spacing: 0.03em;
        }
        .bhu-sidebar-team { color: var(--faint); font-size: 10.5px; }

        /* ---- main / header ---- */
        .bhu-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .bhu-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--ink);
        }
        .bhu-header-title { font-size: 15px; font-weight: 600; display:flex; align-items:center; gap: 8px; }
        .bhu-live-pill {
          display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--radar);
          background: rgba(79,216,196,0.1); padding: 4px 9px; border-radius: 20px; font-weight: 500;
        }
        .bhu-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--radar); }
        @media (prefers-reduced-motion: no-preference) {
          .bhu-live-dot { animation: bhu-blink 2s ease-in-out infinite; }
        }
        @keyframes bhu-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .bhu-header-right { display: flex; align-items: center; gap: 14px; }
        .bhu-role-pill {
          font-size: 12px; color: var(--text); background: var(--panel-raised); border: 1px solid var(--border);
          padding: 6px 11px; border-radius: 7px; display:flex; align-items:center; gap:6px;
        }
        .bhu-bell { position: relative; color: var(--muted); }
        .bhu-bell-count {
          position: absolute; top: -5px; right: -6px; background: var(--high); color: white; font-size: 9px;
          border-radius: 50%; width: 15px; height: 15px; display:flex; align-items:center; justify-content:center; font-weight:700;
        }

        .bhu-content { padding: 22px 24px 40px; overflow-y: auto; flex: 1; }

        /* ---- kpi ---- */
        .bhu-kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .bhu-kpi { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
        .bhu-kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .bhu-kpi-label { color: var(--muted); font-size: 11.5px; font-weight: 500; }
        .bhu-kpi-value { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; margin-top: 3px; }
        .bhu-kpi-sub { color: var(--faint); font-size: 11px; margin-top: 2px; }
        .bhu-kpi-icon { color: var(--radar); background: rgba(79,216,196,0.1); padding: 6px; border-radius: 7px; }
        .bhu-kpi-trend { margin-top: 4px; }

        /* ---- panels ---- */
        .bhu-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
        .bhu-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
        .bhu-panel-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 7px; letter-spacing: 0.01em; }
        .bhu-panel-sub { color: var(--faint); font-size: 11px; }

        .bhu-overview-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; margin-bottom: 14px; align-items: start; }
        @media (max-width: 980px) { .bhu-overview-grid { grid-template-columns: 1fr; } }

        /* ---- map ---- */
        .bhu-map-panel { padding-bottom: 10px; }
        .bhu-map {
          position: relative; height: 360px; border-radius: 8px; overflow: hidden;
          background: radial-gradient(circle at 30% 20%, #16281F 0%, #0C1713 70%);
          border: 1px solid var(--border);
        }
        .bhu-map-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(79,216,196,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(79,216,196,0.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .bhu-map-contours { position: absolute; inset: 0; width: 100%; height: 100%; }
        .bhu-map-contours path { fill: none; stroke: rgba(143,167,155,0.16); stroke-width: 0.4; }
        .bhu-map-rings { position: absolute; left: 18%; top: 22%; }
        .bhu-ring { position: absolute; border: 1px solid rgba(79,216,196,0.18); border-radius: 50%; transform: translate(-50%,-50%); }
        .bhu-ring-1 { width: 60px; height: 60px; }
        .bhu-ring-2 { width: 130px; height: 130px; }
        .bhu-ring-3 { width: 210px; height: 210px; }
        .bhu-map-sweep-wrap { position: absolute; left: 18%; top: 22%; width: 0; height: 0; }
        .bhu-map-sweep {
          position: absolute; width: 240px; height: 240px; left: -120px; top: -120px;
          background: conic-gradient(from 0deg, rgba(79,216,196,0.28), transparent 26%);
          border-radius: 50%; transform-origin: center;
        }
        @media (prefers-reduced-motion: no-preference) {
          .bhu-map-sweep { animation: bhu-sweep 7s linear infinite; }
        }
        @keyframes bhu-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .bhu-marker {
          position: absolute; transform: translate(-50%, -50%); width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center; border-radius: 50%;
        }
        .bhu-marker-core { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--ink); }
        .bhu-marker-high .bhu-marker-core { background: var(--high); }
        .bhu-marker-medium .bhu-marker-core { background: var(--med); }
        .bhu-marker-low .bhu-marker-core { background: var(--low); }
        .bhu-marker-pulse {
          position: absolute; inset: 0; border-radius: 50%; background: var(--high-soft);
        }
        @media (prefers-reduced-motion: no-preference) {
          .bhu-marker-pulse { animation: bhu-pulse 2.2s ease-out infinite; }
        }
        @keyframes bhu-pulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.4); opacity: 0; } }
        .bhu-marker-active .bhu-marker-core { outline: 2px solid var(--text); outline-offset: 2px; }

        .bhu-map-legend {
          position: absolute; left: 12px; bottom: 12px; display: flex; gap: 12px;
          background: rgba(10,21,18,0.7); padding: 6px 10px; border-radius: 7px; font-size: 11px; color: var(--muted);
          backdrop-filter: blur(2px);
        }
        .bhu-map-legend span { display: flex; align-items: center; gap: 5px; }
        .bhu-map-caption {
          position: absolute; right: 12px; bottom: 12px; font-size: 10.5px; color: var(--faint);
          display: flex; align-items: center; gap: 5px; background: rgba(10,21,18,0.7); padding: 5px 8px; border-radius: 6px;
        }

        .bhu-dot { border-radius: 50%; display: inline-block; }
        .bhu-dot-high { background: var(--high); }
        .bhu-dot-medium { background: var(--med); }
        .bhu-dot-low { background: var(--low); }

        /* ---- queue ---- */
        .bhu-queue-list { display: flex; flex-direction: column; gap: 6px; }
        .bhu-queue-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px;
          border: 1px solid transparent; text-align: left; width: 100%;
        }
        .bhu-queue-item:hover { background: var(--panel-raised); }
        .bhu-queue-item-active { background: var(--panel-raised); border-color: var(--radar); }
        .bhu-queue-item-body { flex: 1; min-width: 0; }
        .bhu-queue-item-top { display: flex; justify-content: space-between; }
        .bhu-queue-item-id { font-size: 11.5px; color: var(--muted); }
        .bhu-queue-item-score { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; }
        .bhu-queue-item-region { font-size: 12.5px; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bhu-queue-item-chev { color: var(--faint); flex-shrink: 0; }

        /* ---- badges / status ---- */
        .bhu-badge {
          display: inline-flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif;
          font-weight: 700; font-size: 13px; padding: 3px 9px 3px 7px; border-radius: 20px;
        }
        .bhu-badge-high { background: var(--high-soft); color: var(--high); }
        .bhu-badge-medium { background: var(--med-soft); color: var(--med); }
        .bhu-badge-low { background: var(--low-soft); color: var(--low); }
        .bhu-badge-label { font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; font-size: 10.5px; opacity: 0.85; }

        .bhu-status { font-size: 11.5px; text-transform: capitalize; font-weight: 500; }
        .bhu-status-new { color: var(--radar); }
        .bhu-status-verifying { color: var(--med); }
        .bhu-status-escalated { color: var(--high); }
        .bhu-status-resolved { color: var(--low); }

        /* ---- sla ---- */
        .bhu-sla-track { width: 100%; height: 5px; background: var(--panel-raised); border-radius: 3px; overflow: hidden; }
        .bhu-sla-fill { height: 100%; border-radius: 3px; }
        .bhu-sla-fill-ok { background: var(--low); }
        .bhu-sla-fill-warn { background: var(--med); }
        .bhu-sla-fill-breach { background: var(--high); }
        .bhu-sla-fill-done { background: var(--faint); }
        .bhu-sla-label { font-size: 10.5px; color: var(--muted); margin-top: 4px; }
        .bhu-text-breach { color: var(--high); font-weight: 600; }

        /* ---- ledger ---- */
        .bhu-ledger { display: flex; flex-direction: column; }
        .bhu-ledger-item { display: flex; gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--border); }
        .bhu-ledger-item:last-child { border-bottom: none; }
        .bhu-ledger-item-compact { padding: 7px 2px; }
        .bhu-ledger-icon {
          width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; background: var(--panel-raised); color: var(--radar);
        }
        .bhu-ledger-icon-escalation, .bhu-ledger-icon-system { color: var(--high); }
        .bhu-ledger-icon-officer_action { color: var(--med); }
        .bhu-ledger-icon-resolution { color: var(--low); }
        .bhu-ledger-body { flex: 1; min-width: 0; }
        .bhu-ledger-top { display: flex; gap: 10px; font-size: 10.5px; color: var(--faint); }
        .bhu-ledger-case { color: var(--faint); }
        .bhu-ledger-action { font-size: 12.5px; margin-top: 2px; }
        .bhu-ledger-actor { color: var(--text); font-weight: 500; }

        /* ---- alerts tab ---- */
        .bhu-alerts-head { align-items: center; }
        .bhu-alerts-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .bhu-search {
          display: flex; align-items: center; gap: 6px; background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 7px; padding: 6px 10px; color: var(--muted);
        }
        .bhu-search input { background: none; border: none; color: var(--text); font-size: 12.5px; width: 170px; }
        .bhu-search input::placeholder { color: var(--faint); }
        .bhu-filter-group { display: flex; gap: 4px; background: var(--panel-raised); padding: 3px; border-radius: 8px; }
        .bhu-filter-btn { font-size: 11.5px; padding: 5px 10px; border-radius: 6px; color: var(--muted); font-weight: 500; }
        .bhu-filter-btn-active { background: var(--ink); color: var(--text); }

        .bhu-table { display: flex; flex-direction: column; }
        .bhu-table-row {
          display: grid; grid-template-columns: 90px 1.4fr 1.1fr 100px 130px 110px; gap: 10px;
          align-items: center; padding: 10px 6px; text-align: left;
        }
        .bhu-table-head { color: var(--faint); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
        .bhu-table-body { border-bottom: 1px solid var(--border); font-size: 12.5px; width: 100%; }
        .bhu-table-body:hover { background: var(--panel-raised); }
        .bhu-table-row-active { background: var(--panel-raised); box-shadow: inset 2px 0 0 var(--radar); }
        .bhu-table-state { display: block; color: var(--faint); font-size: 11px; }
        .bhu-empty { padding: 20px 6px; color: var(--muted); font-size: 12.5px; }

        /* ---- cases ---- */
        .bhu-cases-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
        .bhu-case-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .bhu-case-id { font-size: 12px; color: var(--muted); }
        .bhu-case-region { font-size: 13.5px; font-weight: 600; margin-top: 2px; }
        .bhu-case-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
        .bhu-case-officer { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; }

        /* ---- stepper ---- */
        .bhu-stepper { display: flex; align-items: center; margin-bottom: 12px; }
        .bhu-step { display: flex; align-items: center; flex: 1; }
        .bhu-step-dot {
          width: 20px; height: 20px; border-radius: 50%; background: var(--panel-raised); color: var(--faint);
          display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;
          border: 1px solid var(--border);
        }
        .bhu-step-dot-active { background: rgba(79,216,196,0.15); color: var(--radar); border-color: var(--radar); }
        .bhu-step-dot-current { background: var(--radar); color: var(--ink); }
        .bhu-step-label { font-size: 10px; color: var(--faint); margin-left: 6px; white-space: nowrap; }
        .bhu-step-label-active { color: var(--muted); }
        .bhu-step-line { flex: 1; height: 1px; background: var(--border); margin: 0 8px; }
        .bhu-step-line-active { background: var(--radar); }

        /* ---- officers ---- */
        .bhu-officers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .bhu-officer-top { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
        .bhu-officer-avatar {
          width: 34px; height: 34px; border-radius: 50%; background: var(--panel-raised); color: var(--radar);
          display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .bhu-officer-name { font-weight: 600; font-size: 13px; }
        .bhu-officer-role { font-size: 10.5px; color: var(--muted); display: flex; align-items: center; gap: 4px; margin-top: 2px; }
        .bhu-officer-stats { display: flex; gap: 16px; border-top: 1px solid var(--border); padding-top: 10px; }
        .bhu-officer-stat-val { display: block; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; }
        .bhu-officer-stat-label { font-size: 10px; color: var(--faint); }

        /* ---- drawer ---- */
        .bhu-drawer-overlay {
          position: fixed; inset: 0; background: rgba(5,10,8,0.55); display: flex; justify-content: flex-end;
          z-index: 50; backdrop-filter: blur(1px);
        }
        .bhu-drawer {
          width: 360px; max-width: 92vw; background: var(--panel); height: 100%; overflow-y: auto;
          padding: 20px; border-left: 1px solid var(--border);
        }
        .bhu-drawer-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .bhu-drawer-id { font-size: 11.5px; color: var(--muted); }
        .bhu-drawer-title { font-size: 17px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; margin-top: 2px; }
        .bhu-drawer-sub { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 4px; margin-top: 3px; }
        .bhu-icon-btn { color: var(--muted); padding: 5px; border-radius: 6px; }
        .bhu-icon-btn:hover { background: var(--panel-raised); color: var(--text); }
        .bhu-drawer-gauge { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .bhu-drawer-gauge-value { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; }
        .bhu-drawer-gauge-label { font-size: 11px; color: var(--muted); }
        .bhu-drawer-note { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0 0 16px; }
        .bhu-drawer-section-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); margin: 14px 0 8px; }
        .bhu-signal-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        .bhu-signal-name { font-size: 11.5px; color: var(--muted); width: 92px; flex-shrink: 0; }
        .bhu-signal-track { flex: 1; height: 5px; background: var(--panel-raised); border-radius: 3px; overflow: hidden; }
        .bhu-signal-fill { height: 100%; border-radius: 3px; }
        .bhu-signal-sar { background: var(--radar); }
        .bhu-signal-lights { background: var(--med); }
        .bhu-signal-vehicle { background: #7C8FE0; }
        .bhu-signal-val { font-size: 11px; color: var(--muted); width: 32px; text-align: right; }
        .bhu-drawer-meta { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
        .bhu-drawer-meta div { display: flex; justify-content: space-between; font-size: 12px; }
        .bhu-drawer-meta-key { color: var(--faint); }
        .bhu-drawer-actions { display: flex; gap: 8px; margin-top: 18px; }

        .bhu-btn { padding: 9px 14px; border-radius: 7px; font-size: 12.5px; font-weight: 600; flex: 1; text-align: center; }
        .bhu-btn-primary { background: var(--radar); color: var(--ink); }
        .bhu-btn-primary:hover { opacity: 0.9; }
        .bhu-btn-ghost { background: var(--panel-raised); color: var(--text); border: 1px solid var(--border); }
        .bhu-btn-ghost:hover { border-color: var(--radar); }
        .bhu-btn-sm { flex: none; padding: 6px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 3px; }

        @media (max-width: 720px) {
          .bhu-sidebar { position: fixed; z-index: 40; left: -220px; transition: left 0.2s; }
          .bhu-kpi-strip { grid-template-columns: repeat(2, 1fr); }
          .bhu-table-row { grid-template-columns: 70px 1fr 90px; }
          .bhu-table-row > span:nth-child(4), .bhu-table-row > span:nth-child(5), .bhu-table-row > span:nth-child(6) { display: none; }
        }
      `}</style>

      <aside className="bhu-sidebar">
        <div className="bhu-brand">
          <div className="bhu-brand-mark">
            <Signal size={18} color="#4FD8C4" />
            <span className="bhu-brand-title">BHUNETRA</span>
          </div>
          <div className="bhu-brand-sub">Mining surveillance &amp; enforcement</div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.key} className={`bhu-nav-item ${tab === n.key ? "bhu-nav-item-active" : ""}`} onClick={() => setTab(n.key)}>
              <n.icon size={15} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="bhu-sidebar-foot">
          <div className="bhu-sim-badge"><Info size={11} /> Simulated data · prototype</div>
          <div className="bhu-sidebar-team">SIH 2026 · Team Netra AI</div>
        </div>
      </aside>

      <div className="bhu-main">
        <header className="bhu-header">
          <div className="bhu-header-title">
            <span className="bhu-live-pill"><span className="bhu-live-dot" /> Monitoring active</span>
          </div>
          <div className="bhu-header-right">
            <div className="bhu-role-pill"><ShieldCheck size={13} /> DMG Officer view</div>
            <button className="bhu-bell" aria-label={`${stats.high} high risk alerts pending`}>
              <Bell size={17} />
              {stats.high > 0 && <span className="bhu-bell-count">{stats.high}</span>}
            </button>
          </div>
        </header>

        <div className="bhu-content">
          {tab === "overview" && <OverviewTab alerts={ALERTS} selectedId={selectedId} setSelectedId={setSelectedId} stats={stats} />}
          {tab === "alerts" && (
            <AlertsTab alerts={ALERTS} selectedId={selectedId} setSelectedId={setSelectedId} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />
          )}
          {tab === "cases" && <CasesTab alerts={ALERTS} setSelectedId={setSelectedId} />}
          {tab === "audit" && <AuditTab />}
          {tab === "officers" && <OfficersTab />}
        </div>
      </div>

      <DetailDrawer alert={selectedAlert} onClose={() => setSelectedId(null)} />
    </div>
  );
}
