"use client";

/**
 * Disputes review page — bureau-grouped dispute item cards.
 *
 * Architecture (per D-20 through D-25):
 * - useQuery(api.disputeItems.listByUser) for reactive real-time updates
 * - useMutation(api.disputeItems.updateDisputeStatus).withOptimisticUpdate for instant UI feedback
 * - Bureau tabs filter items client-side (no extra query)
 * - Approve / Skip replaces buttons with status badge immediately
 * - "Generate Letters for Approved Items" CTA links to /letters (Phase 4)
 */
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { PageGuide } from "@/components/onboarding/PageGuide";

type Bureau = "experian" | "equifax" | "transunion";
type DisputeStatus = "pending_review" | "approved" | "skipped" | "letter_generated" | "sent" | "resolved" | "denied";

interface DisputeItem {
  _id: Id<"dispute_items">;
  reportId: Id<"credit_reports">;
  userId: string;
  bureau: Bureau;
  itemType: string;
  creditorName: string;
  accountNumberLast4?: string;
  description: string;
  disputeReason: string;
  fcraSection: string;
  fcraSectionTitle: string;
  aiConfidence: number;
  status: DisputeStatus;
  createdAt: number;
}

type TabValue = "all" | Bureau;

const BUREAUS: Bureau[] = ["experian", "equifax", "transunion"];

const BUREAU_LABELS: Record<Bureau, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

/** Humanize snake_case/camelCase enum values: "late_payment" → "Late Payment" */
function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Confidence color class based on percentage */
function confidenceColor(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 70) return "text-green-700 bg-green-50";
  if (pct >= 40) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

/** Skeleton placeholder for loading state */
function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-5 w-2/3 rounded bg-gray-200 mb-3" />
      <div className="h-4 w-1/4 rounded bg-gray-200 mb-4" />
      <div className="h-3 w-full rounded bg-gray-100 mb-2" />
      <div className="h-3 w-5/6 rounded bg-gray-100 mb-4" />
      <div className="flex gap-2">
        <div className="h-4 w-16 rounded bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function DisputesPage() {
  const items = useQuery(api.disputeItems.listByUser);
  const router = useRouter();
  const generateLettersAction = useAction(api.letters.generateLetters);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const updateStatus = useMutation(api.disputeItems.updateDisputeStatus).withOptimisticUpdate(
    (localStore, args) => {
      const existing = localStore.getQuery(api.disputeItems.listByUser, {});
      if (existing) {
        localStore.setQuery(
          api.disputeItems.listByUser,
          {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          existing.map((item: any) =>
            item._id === args.disputeId ? { ...item, status: args.status } : item
          )
        );
      }
    }
  );

  const [activeBureau, setActiveBureau] = useState<TabValue>("all");

  // Loading state
  if (items === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dispute Review</h1>
        <div className="grid grid-cols-1 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const typedItems = items as DisputeItem[];

  // Empty state — no items at all
  if (typedItems.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dispute Review</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-gray-600 mb-2">No dispute items yet.</p>
          <p className="text-sm text-gray-500 mb-4">
            Upload and analyze your credit reports to get started.
          </p>
          <Link
            href="/upload"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Upload
          </Link>
        </div>
      </div>
    );
  }

  const filteredItems =
    activeBureau === "all"
      ? typedItems
      : typedItems.filter((i) => i.bureau === activeBureau);

  const approvedCount = typedItems.filter((i) => i.status === "approved").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispute Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review AI-identified disputable items. Approve items to include them in your dispute letters.
        </p>
      </div>

      <PageGuide
        step="disputes"
        title="Review what the AI found"
        tips={[
          "Each card is an item the AI flagged as potentially inaccurate on your report.",
          "Click \"Approve\" on items you want to dispute, or \"Skip\" to leave them for now.",
          "Higher confidence scores (green) are stronger candidates for disputes.",
          "When you're done, scroll down and click \"Generate Letters\" to create your dispute letters.",
        ]}
        nextLabel="After generating, download your letters"
        nextHref="/letters"
      />

      {/* Bureau filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        {(["all", ...BUREAUS] as TabValue[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveBureau(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeBureau === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "all" ? "All" : BUREAU_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Empty state for filtered bureau */}
      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">No items for this bureau.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 mb-8">
          {filteredItems.map((item) => (
            <div
              key={item._id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.creditorName}</h3>
                  {item.accountNumberLast4 && (
                    <span className="text-xs text-gray-400">••••{item.accountNumberLast4}</span>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {humanize(item.itemType)}
                </span>
              </div>

              {/* Dispute reason */}
              <p className="text-sm text-gray-700 mb-3">{item.disputeReason}</p>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* FCRA section badge */}
                <span
                  className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 cursor-default"
                  title={item.fcraSectionTitle}
                >
                  § {item.fcraSection}
                </span>

                {/* Confidence indicator */}
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceColor(item.aiConfidence)}`}
                >
                  {Math.round(item.aiConfidence * 100)}% confidence
                </span>
              </div>

              {/* Action area: approve/skip or status badge */}
              {item.status === "pending_review" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateStatus({ disputeId: item._id, status: "approved" })
                    }
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      updateStatus({ disputeId: item._id, status: "skipped" })
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Skip
                  </button>
                </div>
              ) : (
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : item.status === "letter_generated"
                      ? "bg-blue-100 text-blue-800"
                      : item.status === "sent"
                      ? "bg-indigo-100 text-indigo-800"
                      : item.status === "resolved"
                      ? "bg-emerald-100 text-emerald-800"
                      : item.status === "denied"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.status === "approved" ? "Approved"
                    : item.status === "letter_generated" ? "Letter Generated"
                    : item.status === "sent" ? "Sent"
                    : item.status === "resolved" ? "Resolved"
                    : item.status === "denied" ? "Denied"
                    : "Skipped"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Letters CTA */}
      <div className="mt-6 flex flex-col items-start gap-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 w-full flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {approvedCount > 0
                ? `${approvedCount} item${approvedCount !== 1 ? "s" : ""} approved for dispute letters`
                : "Approve items above to generate dispute letters"}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Letters are generated individually for each bureau.
            </p>
          </div>
          <button
            disabled={approvedCount === 0 || isGenerating}
            onClick={async () => {
              setIsGenerating(true);
              setGenerateError(null);
              try {
                await generateLettersAction({});
                router.push("/letters");
              } catch (err) {
                setGenerateError(
                  err instanceof Error ? err.message : "Letter generation failed. Please try again."
                );
              } finally {
                setIsGenerating(false);
              }
            }}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              approvedCount > 0 && !isGenerating
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isGenerating
              ? "Generating letters..."
              : approvedCount > 0
              ? `Generate Letters (${approvedCount} approved items)`
              : "Generate Letters (no approved items)"}
          </button>
        </div>
        {generateError && (
          <p className="text-sm text-red-600 mt-2">{generateError}</p>
        )}
      </div>
    </div>
  );
}
