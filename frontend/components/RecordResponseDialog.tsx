"use client";

/**
 * RecordResponseDialog — dialog for recording a bureau response to a sent dispute.
 *
 * Two input modes:
 * 1. Upload PDF — uses Convex Storage upload pattern; calls parseResponse action
 * 2. Enter Manually — outcome dropdown + optional notes; calls recordResponseManual mutation
 *
 * Pattern mirrors MarkAsSentDialog in letters/page.tsx:
 * - @base-ui/react/dialog Dialog.Root/Portal/Popup
 * - Controlled externally: parent sets open=true, passes onClose
 */
import { useState, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog } from "@base-ui/react/dialog";

type Outcome = "verified" | "deleted" | "corrected" | "no_response";

export interface RecordResponseDialogProps {
  disputeItemId: Id<"dispute_items">;
  bureau: "experian" | "equifax" | "transunion";
  onClose: () => void;
}

const OUTCOME_LABELS: Record<Outcome, string> = {
  verified:    "Bureau Verified (Denied)",
  deleted:     "Item Deleted (Win!)",
  corrected:   "Item Corrected",
  no_response: "No Response Received",
};

export function RecordResponseDialog({
  disputeItemId,
  bureau,
  onClose,
}: RecordResponseDialogProps) {
  const [tab, setTab] = useState<"upload" | "manual">("upload");

  // Upload tab state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual tab state
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const generateUploadUrl = useMutation(api.bureauResponses.generateResponseUploadUrl);
  const parseResponse = useAction(api.bureauResponses.parseResponse);
  const recordManual = useMutation(api.bureauResponses.recordResponseManual);

  // ── Upload tab handler ────────────────────────────────────────────────────
  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // Step 1: get upload URL from Convex Storage
      const uploadUrl = await generateUploadUrl();

      // Step 2: PUT file bytes to the storage URL
      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putResponse.ok) {
        throw new Error(`Upload failed: ${putResponse.statusText}`);
      }

      // Step 3: get storageId from PUT response JSON
      const { storageId } = await putResponse.json() as { storageId: Id<"_storage"> };

      // Step 4: call parseResponse action — throws on unknown outcome
      await parseResponse({ storageId, disputeItemId, bureau });

      // Step 5: success
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      const isUnknown = message.toLowerCase().includes("unknown") || message.toLowerCase().includes("outcome");
      setError(
        isUnknown
          ? `Could not automatically read the PDF (${message}). Try the "Enter Manually" tab instead.`
          : message
      );
    } finally {
      setUploading(false);
    }
  }

  // ── Manual entry handler ──────────────────────────────────────────────────
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome) {
      setError("Please select an outcome.");
      return;
    }
    setError(null);
    try {
      await recordManual({
        disputeItemId,
        bureau,
        outcome,
        reasonCode: notes.trim() || undefined,
      });
      setSuccess(true);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setError(message);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Popup className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
            Record Bureau Response
          </Dialog.Title>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            <button
              type="button"
              onClick={() => { setTab("upload"); setError(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload PDF
            </button>
            <button
              type="button"
              onClick={() => { setTab("manual"); setError(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === "manual"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Enter Manually
            </button>
          </div>

          {/* Success state */}
          {success && (
            <p className="text-sm text-green-700 font-medium text-center py-4">
              Response recorded successfully!
            </p>
          )}

          {/* Error message */}
          {error && !success && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}

          {/* ── Upload tab ── */}
          {!success && tab === "upload" && (
            <form onSubmit={handleUploadSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bureau Response PDF
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
                />
              </label>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Upload the PDF letter you received from {bureau.charAt(0).toUpperCase() + bureau.slice(1)}.
                We&apos;ll automatically extract the outcome.
              </p>
              <div className="flex gap-2 justify-end">
                <Dialog.Close
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={onClose}
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? "Processing..." : "Upload & Parse"}
                </button>
              </div>
            </form>
          )}

          {/* ── Manual tab ── */}
          {!success && tab === "manual" && (
            <form onSubmit={handleManualSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outcome
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as Outcome | "")}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select outcome...</option>
                  {(Object.entries(OUTCOME_LABELS) as [Outcome, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                Notes / Reason Code (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Account verified as accurate per section 611 FCRA..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </label>
              <div className="flex gap-2 mt-5 justify-end">
                <Dialog.Close
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={onClose}
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={!outcome}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Response
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
