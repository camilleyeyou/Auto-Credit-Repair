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
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";

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

export default function TrackerPage() {
  const data = useQuery(api.letters.getSentLetters);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
