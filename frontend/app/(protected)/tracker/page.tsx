"use client";

/**
 * /tracker page — color-coded dispute status timeline with filter tabs.
 *
 * Architecture (per D-10 through D-14):
 * - useQuery(api.letters.getSentLetters) for joined { letter, item }[] data
 * - Data sorted by deadline ascending from the query (most urgent first)
 * - Filter tabs: All, Active (sent + not overdue), Overdue (sent + past deadline), Resolved
 * - Overdue tab shows only status="sent" past deadline — NOT denied items (Pitfall 7)
 * - Color coding: blue (active), amber (approaching <=5 days), red bg (overdue), green (resolved), red border (denied)
 *
 * Phase 6 extensions:
 * - Record Response button → RecordResponseDialog (PDF upload or manual entry)
 * - Outcome badges (Resolved / Denied / No Response) after recording
 * - Generate Demand Letter (overdue + no response)
 * - Generate Escalation Letter (denied outcome)
 * - CFPB section: narrative generation, read-only textarea, status dropdown, CFPB link
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";
import { RecordResponseDialog } from "@/components/RecordResponseDialog";

// Tracker entry shape returned by getSentLetters (loop-join of dispute_letters + dispute_items)
interface TrackerEntry {
  letter: {
    _id: string;
    bureau: string;
    generatedAt: number;
    sentAt: number;
    certifiedMailNumber?: string;
    deadline: number;
  };
  item: {
    _id: string;
    creditorName: string;
    bureau: string;
    fcraSection: string;
    disputeReason: string;
    status: string;
    accountNumberLast4?: string;
  };
}

type FilterTab = "all" | "active" | "overdue" | "resolved";

// D-12: color coding by urgency and status
function getUrgencyClasses(days: number, status: string): string {
  if (status === "resolved") return "border-green-200 bg-green-50";
  if (status === "denied")   return "border-red-300 bg-white";      // red outline, not fill
  if (days < 0)              return "border-red-200 bg-red-50";     // overdue
  if (days <= 5)             return "border-amber-200 bg-amber-50"; // approaching
  return "border-blue-200 bg-blue-50";                              // sent/waiting
}

function getDaysLabel(days: number, status: string): string {
  if (status === "resolved") return "Resolved";
  if (status === "denied")   return "Denied";
  if (days < 0)              return `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`;
  if (days === 0)            return "Due today";
  return `${days} day${days !== 1 ? "s" : ""} remaining`;
}

function getDaysTextColor(days: number, status: string): string {
  if (status === "resolved") return "text-green-700 font-medium";
  if (status === "denied")   return "text-red-700 font-medium";
  if (days < 0)              return "text-red-700 font-bold";
  if (days <= 5)             return "text-amber-700 font-semibold";
  return "text-blue-700";
}

const BUREAU_LABEL: Record<string, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

const BUREAU_BADGE: Record<string, string> = {
  experian: "bg-red-100 text-red-700",
  equifax: "bg-blue-100 text-blue-700",
  transunion: "bg-cyan-100 text-cyan-700",
};

// Phase 6: CFPB portal status labels
const CFPB_STATUS_LABELS: Record<string, string> = {
  draft:             "Draft",
  filed:             "Filed",
  response_received: "Response Received",
  closed:            "Closed",
};

export default function TrackerPage() {
  const data = useQuery(api.letters.getSentLetters);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // Phase 6: response and CFPB data
  const responses = useQuery(api.bureauResponses.getResponsesForUser);
  const cfpbComplaints = useQuery(api.cfpbComplaints.getCfpbComplaintsForUser);

  // Phase 6: actions and mutations
  const generateDemandLetter = useAction(api.bureauResponses.generateDemandLetter);
  const generateEscalationLetter = useAction(api.bureauResponses.generateEscalationLetter);
  const generateCfpbNarrative = useAction(api.cfpbComplaints.generateCfpbNarrative);
  const updateCfpbStatus = useMutation(api.cfpbComplaints.updateCfpbStatus);

  // Phase 6: UI state
  const [openResponseDialogId, setOpenResponseDialogId] = useState<string | null>(null);
  const [generatingDemand, setGeneratingDemand] = useState<string | null>(null);
  const [generatingEscalation, setGeneratingEscalation] = useState<string | null>(null);
  const [generatingCfpb, setGeneratingCfpb] = useState<string | null>(null);
  const [expandedCfpb, setExpandedCfpb] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});

  // Phase 6: build response lookup map (most recent response per dispute item)
  const responseByDisputeId = useMemo(() => {
    const map: Record<string, NonNullable<typeof responses>[number]> = {};
    responses?.forEach((r) => {
      if (!map[r.disputeItemId] || r.recordedAt > map[r.disputeItemId].recordedAt) {
        map[r.disputeItemId] = r;
      }
    });
    return map;
  }, [responses]);

  // Phase 6: build CFPB lookup map (most recent complaint per dispute item)
  const cfpbByDisputeId = useMemo(() => {
    const map: Record<string, NonNullable<typeof cfpbComplaints>[number]> = {};
    cfpbComplaints?.forEach((c) => {
      if (!map[c.disputeItemId] || c.generatedAt > map[c.disputeItemId].generatedAt) {
        map[c.disputeItemId] = c;
      }
    });
    return map;
  }, [cfpbComplaints]);

  function setItemError(id: string, msg: string) {
    setActionError((prev) => ({ ...prev, [id]: msg }));
  }

  function clearItemError(id: string) {
    setActionError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Loading state
  if (data === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dispute Tracker</h1>
        <p className="text-sm text-gray-500 mb-6">
          Track your sent letters and 30-day response windows.
        </p>
        <p className="text-muted-foreground text-sm">Loading tracker...</p>
      </div>
    );
  }

  const typedData = data as TrackerEntry[];

  // Filter logic — Pitfall 7: overdue = sent + past deadline (NOT denied)
  const filtered = typedData.filter(({ letter, item }) => {
    const days = differenceInCalendarDays(new Date(letter.deadline), new Date());
    if (activeFilter === "active")   return item.status === "sent" && days >= 0;
    if (activeFilter === "overdue")  return item.status === "sent" && days < 0; // ONLY sent+past, not denied
    if (activeFilter === "resolved") return item.status === "resolved" || item.status === "denied";
    return true; // "all"
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispute Tracker</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your sent letters and 30-day response windows.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["all", "active", "overdue", "resolved"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeFilter === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state — no sent disputes at all */}
      {typedData.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-gray-600 mb-2">No sent disputes yet.</p>
          <p className="text-sm text-gray-500 mb-4">
            Mark your letters as sent from the Letters page to start tracking deadlines.
          </p>
          <Link
            href="/letters"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Letters
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state for active filter */
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            No {activeFilter === "all" ? "" : activeFilter + " "}disputes to show.
          </p>
        </div>
      ) : (
        /* Tracker cards — sorted by deadline ascending (most urgent first) */
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(({ letter, item }) => {
            const days = differenceInCalendarDays(new Date(letter.deadline), new Date());
            const response = responseByDisputeId[item._id];
            const cfpb = cfpbByDisputeId[item._id];
            const itemError = actionError[item._id];

            // Outcome badge logic
            const hasResponse = !!response;
            const isResolved = response?.outcome === "deleted" || response?.outcome === "corrected";
            const isDenied = response?.outcome === "verified";
            const isNoResponse = response?.outcome === "no_response";

            // Contextual button visibility
            const isOverdueNoResponse =
              item.status === "sent" && days < 0 && !hasResponse;
            const showEscalation = isDenied;
            const showCfpb = isDenied; // show after denied response

            return (
              <div
                key={letter._id}
                className={`rounded-lg border-2 p-5 ${getUrgencyClasses(days, item.status)}`}
              >
                {/* Card header: creditor + bureau badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.creditorName}</h3>
                    {item.accountNumberLast4 && (
                      <p className="text-xs text-gray-500">...{item.accountNumberLast4}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BUREAU_BADGE[item.bureau] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {BUREAU_LABEL[item.bureau] ?? item.bureau}
                  </span>
                </div>

                {/* Days remaining / overdue label */}
                <p className={`mt-2 text-sm ${getDaysTextColor(days, item.status)}`}>
                  {getDaysLabel(days, item.status)}
                </p>

                {/* Dates and tracking number */}
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>Sent: {format(new Date(letter.sentAt), "MMM d, yyyy")}</p>
                  <p>Deadline: {format(new Date(letter.deadline), "MMM d, yyyy")}</p>
                  {letter.certifiedMailNumber && (
                    <p>Tracking: {letter.certifiedMailNumber}</p>
                  )}
                </div>

                {/* FCRA section and dispute reason */}
                <p className="mt-2 text-xs text-gray-400">
                  {item.fcraSection} — {item.disputeReason}
                </p>

                {/* ── Phase 6: Response recording and escalation section ── */}
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">

                  {/* Per-card action error */}
                  {itemError && (
                    <p className="text-sm text-red-600">{itemError}</p>
                  )}

                  {/* Outcome badge OR Record Response button */}
                  {hasResponse ? (
                    <div className="flex items-center gap-2">
                      {isResolved && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 border border-green-200">
                          Resolved
                        </span>
                      )}
                      {isDenied && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">
                          Denied
                        </span>
                      )}
                      {isNoResponse && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 border border-gray-200">
                          No Response
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { clearItemError(item._id); setOpenResponseDialogId(item._id); }}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Record Response
                    </button>
                  )}

                  {/* Generate Demand Letter — overdue + no response */}
                  {isOverdueNoResponse && (
                    <div>
                      <button
                        type="button"
                        disabled={generatingDemand === item._id}
                        onClick={async () => {
                          clearItemError(item._id);
                          setGeneratingDemand(item._id);
                          try {
                            await generateDemandLetter({
                              disputeItemId: item._id as Id<"dispute_items">,
                              letterId: letter._id as Id<"dispute_letters">,
                            });
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : "Failed to generate demand letter.";
                            setItemError(item._id, msg);
                          } finally {
                            setGeneratingDemand(null);
                          }
                        }}
                        className="inline-flex items-center rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
                      >
                        {generatingDemand === item._id ? "Generating..." : "Generate Demand Letter"}
                      </button>
                    </div>
                  )}

                  {/* Generate Escalation Letter — denied */}
                  {showEscalation && response && (
                    <div>
                      <button
                        type="button"
                        disabled={generatingEscalation === item._id}
                        onClick={async () => {
                          clearItemError(item._id);
                          setGeneratingEscalation(item._id);
                          try {
                            await generateEscalationLetter({
                              disputeItemId: item._id as Id<"dispute_items">,
                              bureauResponseId: response._id,
                            });
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : "Failed to generate escalation letter.";
                            setItemError(item._id, msg);
                          } finally {
                            setGeneratingEscalation(null);
                          }
                        }}
                        className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {generatingEscalation === item._id ? "Generating..." : "Generate Escalation Letter"}
                      </button>
                    </div>
                  )}

                  {/* CFPB section — show for denied disputes */}
                  {showCfpb && response && (
                    <div className="rounded-md border border-purple-200 bg-purple-50 p-3 space-y-2">
                      <p className="text-sm font-medium text-purple-800">CFPB Complaint</p>

                      {cfpb ? (
                        /* Narrative exists — show textarea, status, link */
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCfpb(expandedCfpb === item._id ? null : item._id)}
                            className="text-xs text-purple-700 underline hover:no-underline"
                          >
                            {expandedCfpb === item._id ? "Hide narrative" : "Show narrative"}
                          </button>

                          {expandedCfpb === item._id && (
                            <textarea
                              readOnly
                              value={cfpb.narrative}
                              rows={6}
                              className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm text-gray-700 resize-none"
                            />
                          )}

                          {/* CFPB status dropdown */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-purple-700">Status:</label>
                            <select
                              value={cfpb.portalStatus ?? "draft"}
                              onChange={async (e) => {
                                try {
                                  await updateCfpbStatus({
                                    complaintId: cfpb._id,
                                    portalStatus: e.target.value as "draft" | "filed" | "response_received" | "closed",
                                  });
                                } catch (err: unknown) {
                                  const msg = err instanceof Error ? err.message : "Failed to update status.";
                                  setItemError(item._id, msg);
                                }
                              }}
                              className="rounded-md border border-purple-200 bg-white px-2 py-1 text-sm text-gray-700"
                            >
                              {Object.entries(CFPB_STATUS_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Link to CFPB complaint portal */}
                          <a
                            href="https://www.consumerfinance.gov/complaint/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-purple-700 underline hover:no-underline"
                          >
                            File at CFPB →
                          </a>
                        </div>
                      ) : (
                        /* No narrative yet — show generate button */
                        <button
                          type="button"
                          disabled={generatingCfpb === item._id}
                          onClick={async () => {
                            clearItemError(item._id);
                            setGeneratingCfpb(item._id);
                            try {
                              await generateCfpbNarrative({
                                disputeItemId: item._id as Id<"dispute_items">,
                                bureauResponseId: response._id,
                              });
                            } catch (err: unknown) {
                              const msg = err instanceof Error ? err.message : "Failed to generate CFPB narrative.";
                              setItemError(item._id, msg);
                            } finally {
                              setGeneratingCfpb(null);
                            }
                          }}
                          className="inline-flex items-center rounded-md border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-50"
                        >
                          {generatingCfpb === item._id ? "Generating..." : "Generate CFPB Narrative"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* RecordResponseDialog — rendered inline per item */}
                {openResponseDialogId === item._id && (
                  <RecordResponseDialog
                    disputeItemId={item._id as Id<"dispute_items">}
                    bureau={item.bureau as "experian" | "equifax" | "transunion"}
                    onClose={() => setOpenResponseDialogId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
