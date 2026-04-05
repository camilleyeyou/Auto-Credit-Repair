"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";

const BUREAU_LABEL: Record<string, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

interface DashboardStats {
  totalDisputes: number;
  lettersGenerated: number;
  lettersSent: number;
  responsesReceived: number;
  resolved: number;
  overdue: number;
}

interface DeadlineEntry {
  letter: { deadline: number; sentAt: number; certifiedMailNumber?: string };
  item: { creditorName: string; bureau: string; status: string };
}

interface SentEntry {
  letter: { _id: string; sentAt: number; deadline: number; certifiedMailNumber?: string };
  item: { creditorName: string; bureau: string; status: string };
}

export default function DashboardPage() {
  const stats = useQuery(api.letters.getDashboardStats) as DashboardStats | undefined;
  const upcomingDeadlines = useQuery(api.letters.getUpcomingDeadlines) as DeadlineEntry[] | undefined;
  const sentLetters = useQuery(api.letters.getSentLetters) as SentEntry[] | undefined;

  if (stats === undefined || upcomingDeadlines === undefined || sentLetters === undefined) {
    return (
      <div>
        <h1 className="text-[#0F172A] mb-1">Dashboard</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const now = new Date();
  const overdueItems = sentLetters.filter(({ letter, item }) =>
    item.status === "sent" && differenceInCalendarDays(new Date(letter.deadline), now) < 0
  );
  const recentActivity = [...sentLetters]
    .sort((a, b) => b.letter.sentAt - a.letter.sentAt)
    .slice(0, 5);

  const summaryCards = [
    { label: "Total Disputes", value: stats.totalDisputes, color: "text-[#0F172A]", bg: "bg-slate-50", icon: "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" },
    { label: "Letters Generated", value: stats.lettersGenerated, color: "text-[#1E3A8A]", bg: "bg-blue-50", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
    { label: "Letters Sent", value: stats.lettersSent, color: "text-[#7C3AED]", bg: "bg-violet-50", icon: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" },
    { label: "Responses", value: stats.responsesReceived, color: "text-[#A16207]", bg: "bg-amber-50", icon: "M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" },
    { label: "Resolved", value: stats.resolved, color: "text-[#059669]", bg: "bg-emerald-50", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#0F172A]">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Your credit repair progress at a glance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {summaryCards.map(({ label, value, color, bg, icon }) => (
          <div key={label} className={`rounded-xl ${bg} border border-slate-100 p-5 card-hover`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
              <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
            </div>
            <p className={`text-3xl font-bold ${color} tracking-tight`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Overdue Alert Banner */}
      {stats.overdue > 0 && (
        <div className="mb-8 rounded-xl bg-red-50 border border-red-200/60 p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-800">
                {stats.overdue} dispute{stats.overdue !== 1 ? "s" : ""} overdue
              </h2>
              <ul className="mt-2 space-y-1.5">
                {overdueItems.slice(0, 3).map(({ letter, item }, idx) => {
                  const days = Math.abs(differenceInCalendarDays(new Date(letter.deadline), now));
                  return (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-red-900 font-medium">{item.creditorName}</span>
                      <span className="text-red-600 text-xs font-medium">{days}d overdue</span>
                    </li>
                  );
                })}
              </ul>
              <Link href="/tracker" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800">
                View in Tracker
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Deadlines + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Upcoming Deadlines */}
        <div className="rounded-xl bg-white border border-slate-100 p-6 card-hover">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-4">Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <div className="text-center py-6">
              <svg className="h-8 w-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-400">No deadlines in the next 7 days</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingDeadlines.map(({ letter, item }, idx) => {
                const days = differenceInCalendarDays(new Date(letter.deadline), now);
                return (
                  <li key={idx} className="flex items-center justify-between gap-2 py-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{item.creditorName}</p>
                      <p className="text-xs text-slate-400">{BUREAU_LABEL[item.bureau] ?? item.bureau} &middot; {format(new Date(letter.deadline), "MMM d")}</p>
                    </div>
                    <span className={`shrink-0 status-pill ${days <= 3 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-[#1E3A8A]"}`}>
                      {days}d left
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl bg-white border border-slate-100 p-6 card-hover">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-4">Quick Actions</h2>
          <div className="space-y-2.5">
            <Link href="/upload" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-[#1E3A8A] flex items-center justify-center shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A] group-hover:text-[#1E3A8A]">Upload New Report</p>
                <p className="text-xs text-slate-400">Add a credit report PDF for analysis</p>
              </div>
            </Link>
            <Link href="/disputes" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-[#A16207] flex items-center justify-center shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A] group-hover:text-[#A16207]">Review Pending Items</p>
                <p className="text-xs text-slate-400">Approve or skip flagged dispute items</p>
              </div>
            </Link>
            <Link href="/letters" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-[#059669] flex items-center justify-center shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A] group-hover:text-[#059669]">Download Letters</p>
                <p className="text-xs text-slate-400">Print and mail your dispute letters</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl bg-white border border-slate-100 p-6 card-hover">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <svg className="h-8 w-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-400">No activity yet. Upload a credit report to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {recentActivity.map(({ letter, item }, idx) => (
              <li key={idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{item.creditorName}</p>
                    <p className="text-xs text-slate-400">{BUREAU_LABEL[item.bureau] ?? item.bureau}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {format(new Date(letter.sentAt), "MMM d")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
