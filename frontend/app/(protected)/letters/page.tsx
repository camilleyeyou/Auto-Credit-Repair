"use client";

/**
 * /letters page — bureau-grouped dispute letter cards.
 *
 * Architecture (per D-20 through D-23):
 * - useQuery(api.letters.listByUser) for reactive letter list
 * - Letters grouped by bureau client-side
 * - Each card: bureau, generated date, Preview toggle, Download PDF button
 * - LetterCard child component fetches its own download URL reactively
 * - MarkAsSentDialog: opens on button click, collects send date + tracking number,
 *   calls markAsSent mutation, card reactively updates to show sent status
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { format } from "date-fns";
import { PageGuide } from "@/components/onboarding/PageGuide";

type Bureau = "experian" | "equifax" | "transunion";

interface DisputeLetter {
  _id: Id<"dispute_letters">;
  disputeItemId: Id<"dispute_items">;
  userId: string;
  bureau: Bureau;
  letterContent: string;
  storageId: Id<"_storage">;
  generatedAt: number;
  // New optional fields from Plan 01:
  sentAt?: number;
  certifiedMailNumber?: string;
  deadline?: number;
  // Plan 06: letter type for demand/escalation badges (mov added in MOV phase)
  letterType?: "initial" | "demand" | "escalation" | "mov";
}

// Plan 06: letter type badge configuration
const LETTER_TYPE_LABEL: Record<string, { label: string; className: string }> = {
  demand:     { label: "Demand",     className: "bg-orange-100 text-orange-700 border border-orange-200" },
  escalation: { label: "Escalation", className: "bg-red-100 text-red-700 border border-red-200" },
  initial:    { label: "Initial",    className: "bg-blue-100 text-blue-700 border border-blue-200" },
  mov:        { label: "MOV",        className: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
};

const BUREAU_LABELS: Record<Bureau, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

const BUREAUS: Bureau[] = ["experian", "equifax", "transunion"];

/**
 * MarkAsSentDialog — dialog for recording that a letter was mailed.
 * Collects send date (defaults to today) and optional certified mail number.
 * Calls markAsSent mutation on submit; closes on success (Convex reactive
 * query auto-refreshes the parent LetterCard).
 */
function MarkAsSentDialog({
  letterId,
  onSuccess,
}: {
  letterId: Id<"dispute_letters">;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(today);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAsSent = useMutation(api.letters.markAsSent);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Use T12:00:00 to avoid off-by-one day at UTC boundaries
      const sentAt = new Date(dateValue + "T12:00:00").getTime();
      await markAsSent({
        letterId,
        sentAt,
        certifiedMailNumber: trackingNumber.trim() || undefined,
      });
      onSuccess();
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        Mark as Sent
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
            Mark Letter as Sent
          </Dialog.Title>
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send Date
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">
              Certified Mail Tracking Number (optional)
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 9400111899223396942347"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2 mt-5 justify-end">
              <Dialog.Close
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Confirm Sent"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * LetterCard — renders a single letter card.
 * Fetches its own download URL reactively via useQuery.
 * Manages local preview toggle state.
 * Shows Mark as Sent button for unsent letters; shows sent status for sent letters.
 */
function LetterCard({ letter }: { letter: DisputeLetter }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reactive download URL — null while loading or if storage missing
  const downloadUrl = useQuery(api.letters.getLetterDownloadUrl, {
    letterId: letter._id,
  });

  const formattedDate = format(new Date(letter.generatedAt), "MMMM d, yyyy");
  const bureauLabel = BUREAU_LABELS[letter.bureau] ?? letter.bureau;
  // Filename uses bureau + date for clear identification
  const filename = `dispute-letter-${letter.bureau}-${format(new Date(letter.generatedAt), "yyyy-MM-dd")}.pdf`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="font-semibold text-gray-900">{bureauLabel}</h3>
            <p className="text-sm text-gray-500 mt-0.5">Generated {formattedDate}</p>
            {/* Plan 06: letterType badge — Initial / Demand / Escalation */}
            {(() => {
              const typeKey = letter.letterType ?? "initial";
              const badge = LETTER_TYPE_LABEL[typeKey] ?? LETTER_TYPE_LABEL.initial;
              return (
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              );
            })()}
          </div>
          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            Dispute Letter
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          {/* Download PDF button */}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={filename}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Download PDF
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed"
            >
              {downloadUrl === undefined ? "Loading..." : "Unavailable"}
            </button>
          )}

          {/* Preview toggle */}
          <button
            onClick={() => setPreviewOpen((prev) => !prev)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {previewOpen ? "Hide Preview" : "Preview"}
          </button>

          {/* Mark as Sent — only shown when letter has not yet been sent */}
          {letter.sentAt === undefined && (
            <MarkAsSentDialog letterId={letter._id} onSuccess={() => {}} />
          )}
        </div>

        {/* Sent status — shown after marking as sent */}
        {letter.sentAt !== undefined && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-green-700 font-medium">
              Sent {format(new Date(letter.sentAt), "MMMM d, yyyy")}
            </p>
            {letter.certifiedMailNumber && (
              <p className="text-xs text-gray-500 mt-0.5">
                Tracking: {letter.certifiedMailNumber}
              </p>
            )}
            {letter.deadline && (
              <p className="text-xs text-gray-500 mt-0.5">
                30-day deadline: {format(new Date(letter.deadline), "MMMM d, yyyy")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Inline HTML preview (per D-22) */}
      {previewOpen && (
        <div className="border-t border-gray-200">
          <div
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: letter.letterContent }}
            className="border rounded p-4 mt-2 text-sm max-h-96 overflow-y-auto mx-4 mb-4"
          />
        </div>
      )}
    </div>
  );
}

export default function LettersPage() {
  const letters = useQuery(api.letters.listByUser);

  // Loading state
  if (letters === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dispute Letters</h1>
        <p className="text-sm text-gray-500 mb-6">
          Download and print your bureau dispute letters.
        </p>
        <p className="text-muted-foreground text-sm">Loading letters...</p>
      </div>
    );
  }

  // Empty state — no letters generated yet
  if (letters.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dispute Letters</h1>
        <p className="text-sm text-gray-500 mb-6">
          Download and print your bureau dispute letters.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-gray-600 mb-2">No letters generated yet.</p>
          <p className="text-sm text-gray-500 mb-4">
            Go to the Disputes page to approve items and generate letters.
          </p>
          <Link
            href="/disputes"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Disputes
          </Link>
        </div>
      </div>
    );
  }

  // Group letters by bureau client-side (same pattern as disputes page)
  const typedLetters = letters as DisputeLetter[];
  const lettersByBureau = BUREAUS.reduce<Record<Bureau, DisputeLetter[]>>(
    (acc, bureau) => {
      acc[bureau] = typedLetters.filter((l) => l.bureau === bureau);
      return acc;
    },
    { experian: [], equifax: [], transunion: [] }
  );

  const totalCount = typedLetters.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dispute Letters</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download and print your bureau dispute letters.{" "}
          <span className="text-gray-400">
            {totalCount} letter{totalCount !== 1 ? "s" : ""} total
          </span>
        </p>
      </div>

      <PageGuide
        step="letters"
        title="Your dispute letters are ready"
        tips={[
          "Click \"Download PDF\" to save each letter to your computer.",
          "Print the letters and mail them via USPS Certified Mail (about $4-5 each).",
          "After mailing, click \"Mark as Sent\" and enter your tracking number.",
          "This starts the 30-day countdown — the bureau must respond by law.",
        ]}
        nextLabel="After mailing, track your disputes"
        nextHref="/tracker"
      />

      {/* Bureau sections — only render if that bureau has letters */}
      <div className="space-y-8">
        {BUREAUS.map((bureau) => {
          const bureauLetters = lettersByBureau[bureau];
          if (bureauLetters.length === 0) return null;

          return (
            <section key={bureau}>
              <h2 className="text-lg font-medium text-gray-800 mb-3 pb-2 border-b border-gray-200">
                {BUREAU_LABELS[bureau]}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({bureauLetters.length} letter{bureauLetters.length !== 1 ? "s" : ""})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {bureauLetters.map((letter) => (
                  <LetterCard key={letter._id} letter={letter} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Reminder to print and mail */}
      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <span className="font-medium">Reminder:</span> Print and mail each letter via{" "}
          <span className="font-medium">USPS Certified Mail</span> to the respective bureau.
          Keep your tracking numbers for your records.
        </p>
      </div>
    </div>
  );
}
