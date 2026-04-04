"use client";

/**
 * /dashboard page — credit repair progress summary.
 *
 * Architecture (per D-15 through D-20):
 * - getDashboardStats: 5 summary stat cards
 * - getUpcomingDeadlines: disputes approaching 30-day deadline within 7 days
 * - getSentLetters: used for overdue alerts section and recent activity feed
 * - Quick Action buttons linking to /upload, /disputes, /letters
 */
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";

const BUREAU_BADGE: Record<string, string> = {
  experian: "bg-red-100 text-red-700",
  equifax: "bg-blue-100 text-blue-700",
  transunion: "bg-cyan-100 text-cyan-700",
};

const BUREAU_LABEL: Record<string, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

// Shape of getDashboardStats return
interface DashboardStats {
  totalDisputes: number;
  lettersGenerated: number;
  lettersSent: number;
  responsesReceived: number;
  resolved: number;
  overdue: number;
}

// Shape of getUpcomingDeadlines return entries
interface DeadlineEntry {
  letter: {
    deadline: number;
    sentAt: number;
    certifiedMailNumber?: string;
  };
  item: {
    creditorName: string;
    bureau: string;
    status: string;
  };
}

// Shape of getSentLetters return entries
interface SentEntry {
  letter: {
    _id: string;
    sentAt: number;
    deadline: number;
    certifiedMailNumber?: string;
  };
  item: {
    creditorName: string;
    bureau: string;
    status: string;
  };
}

export default function DashboardPage() {
  const stats = useQuery(api.letters.getDashboardStats) as DashboardStats | undefined;
  const upcomingDeadlines = useQuery(api.letters.getUpcomingDeadlines) as DeadlineEntry[] | undefined;
  const sentLetters = useQuery(api.letters.getSentLetters) as SentEntry[] | undefined;

  // Loading state — show while any query is still loading
  if (stats === undefined || upcomingDeadlines === undefined || sentLetters === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  const now = new Date();

  // Overdue items: sent letters where status is still "sent" and past deadline
  const overdueItems = sentLetters.filter(({ letter, item }) =>
    item.status === "sent" && differenceInCalendarDays(new Date(letter.deadline), now) < 0
  );

  // Recent activity: 5 most recently sent letters (sort by sentAt desc)
  const recentActivity = [...sentLetters]
    .sort((a, b) => b.letter.sentAt - a.letter.sentAt)
    .slice(0, 5);

  // Summary card data
  const summaryCards = [
    { label: "Total Disputes",       value: stats.totalDisputes,     accent: "text-gray-900" },
    { label: "Letters Generated",    value: stats.lettersGenerated,  accent: "text-blue-700" },
    { label: "Letters Sent",         value: stats.lettersSent,       accent: "text-indigo-700" },
    { label: "Responses Received",   value: stats.responsesReceived, accent: "text-purple-700" },
    { label: "Resolved",             value: stats.resolved,          accent: "text-green-700" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your credit repair progress at a glance.
        </p>
      </div>

      {/* Summary cards row — 2 cols mobile, 5 cols desktop (D-16) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {summaryCards.map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Overdue Alerts (D-18, TRK-04) — shown only when overdue > 0 */}
      {stats.overdue > 0 && (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-base font-bold text-red-800 mb-3">
            Overdue Disputes ({stats.overdue})
          </h2>
          <ul className="space-y-2">
            {overdueItems.map(({ letter, item }, idx) => {
              const days = differenceInCalendarDays(new Date(letter.deadline), now);
              return (
                <li key={idx} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-red-900">{item.creditorName}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUREAU_BADGE[item.bureau] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {BUREAU_LABEL[item.bureau] ?? item.bureau}
                    </span>
                    <span className="text-xs text-red-700 font-semibold">
                      {Math.abs(days)} day{Math.abs(days) !== 1 ? "s" : ""} overdue
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/tracker" className="mt-3 inline-block text-xs font-medium text-red-700 underline hover:text-red-800">
            View all in Tracker
          </Link>
        </div>
      )}

      {/* Two-column grid: Upcoming Deadlines + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Upcoming Deadlines (D-17) */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Upcoming Deadlines
          </h2>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-gray-500">No deadlines in the next 7 days.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingDeadlines.map(({ letter, item }, idx) => {
                const days = differenceInCalendarDays(new Date(letter.deadline), now);
                return (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.creditorName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(letter.deadline), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUREAU_BADGE[item.bureau] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {BUREAU_LABEL[item.bureau] ?? item.bureau}
                      </span>
                      <span
                        className={`text-xs font-semibold ${days <= 3 ? "text-amber-700" : "text-blue-700"}`}
                      >
                        {days} day{days !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick Actions (D-19, DASH-03) */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload New Report
            </Link>
            <Link
              href="/disputes"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Review Pending Items
            </Link>
            <Link
              href="/letters"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download Letters
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity (D-20) */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map(({ letter, item }, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm">
                <span className="text-gray-700 font-medium">{item.creditorName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUREAU_BADGE[item.bureau] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {BUREAU_LABEL[item.bureau] ?? item.bureau}
                </span>
                <span className="text-gray-400 text-xs">
                  — sent {format(new Date(letter.sentAt), "MMM d, yyyy")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
