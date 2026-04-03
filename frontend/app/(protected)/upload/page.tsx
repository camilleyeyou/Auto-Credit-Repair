"use client";

/**
 * Upload page — three bureau PDF upload zones.
 *
 * Architecture (per D-06 through D-10):
 * 1. User drops a PDF → local state = "uploading"
 * 2. generateUploadUrl() → POST file directly to Convex Storage
 * 3. saveReport({ storageId, bureau }) → creates credit_reports row (status: "uploaded")
 * 4. parseReport({ reportId }) → Convex action: calls FastAPI, writes result back
 * 5. Local state set to "parsing" while action runs
 * 6. Reactive useQuery on credit_reports detects when parseStatus changes
 * 7. useEffect syncs Convex parseStatus → local UI status
 *
 * Per D-04: each bureau uploads independently.
 * Per D-05: existing reports shown with date; user can re-upload.
 */
import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  BureauDropZone,
  type Bureau,
  type LocalStatus,
} from "@/components/upload/BureauDropZone";

const BUREAUS: Bureau[] = ["experian", "equifax", "transunion"];

export default function UploadPage() {
  const generateUploadUrl = useMutation(api.creditReports.generateUploadUrl);
  const saveReport = useMutation(api.creditReports.saveReport);
  const parseReport = useAction(api.creditReports.parseReport);
  const reports = useQuery(api.creditReports.listByUser);

  const [localStatuses, setLocalStatuses] = useState<Record<Bureau, LocalStatus>>({
    experian: "idle",
    equifax: "idle",
    transunion: "idle",
  });

  // Sync Convex reactive parse status → local UI status
  useEffect(() => {
    if (!reports) return;
    setLocalStatuses((prev) => {
      const updated = { ...prev };
      for (const bureau of BUREAUS) {
        const bureauReports = reports
          .filter((r) => r.bureau === bureau)
          .sort((a, b) => b.uploadedAt - a.uploadedAt);
        const latest = bureauReports[0];
        if (!latest) continue;

        const convexStatus = latest.parseStatus;
        if (
          convexStatus === "done" ||
          convexStatus === "failed" ||
          convexStatus === "image_only"
        ) {
          if (prev[bureau] === "parsing" || prev[bureau] === "done" || prev[bureau] === "failed" || prev[bureau] === "image_only") {
            updated[bureau] = convexStatus as LocalStatus;
          }
        }
      }
      return updated;
    });
  }, [reports]);

  const handleFileAccepted = useCallback(
    async (bureau: Bureau, file: File) => {
      try {
        setLocalStatuses((prev) => ({ ...prev, [bureau]: "uploading" }));

        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file,
        });

        if (!uploadResult.ok) {
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }

        const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> };
        const reportId = await saveReport({ storageId, bureau });

        setLocalStatuses((prev) => ({ ...prev, [bureau]: "parsing" }));
        await parseReport({ reportId });
      } catch (err) {
        console.error(`Upload/parse error for ${bureau}:`, err);
        setLocalStatuses((prev) => ({ ...prev, [bureau]: "failed" }));
      }
    },
    [generateUploadUrl, saveReport, parseReport]
  );

  const latestByBureau = BUREAUS.reduce<Record<Bureau, (typeof reports extends undefined ? never : NonNullable<typeof reports>[0]) | undefined>>(
    (acc, bureau) => {
      if (!reports) {
        acc[bureau] = undefined;
        return acc;
      }
      const sorted = reports
        .filter((r) => r.bureau === bureau)
        .sort((a, b) => b.uploadedAt - a.uploadedAt);
      acc[bureau] = sorted[0];
      return acc;
    },
    {} as Record<Bureau, undefined>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Credit Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a PDF credit report for each bureau. You can upload one, two, or all three.
          Download your free reports from{" "}
          <a
            href="https://www.annualcreditreport.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            annualcreditreport.com
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {BUREAUS.map((bureau) => (
          <BureauDropZone
            key={bureau}
            bureau={bureau}
            localStatus={localStatuses[bureau]}
            existingReport={
              latestByBureau[bureau]
                ? {
                    uploadedAt: latestByBureau[bureau]!.uploadedAt,
                    parseStatus: latestByBureau[bureau]!.parseStatus,
                    errorMessage: latestByBureau[bureau]!.errorMessage,
                    confidence: latestByBureau[bureau]!.confidence,
                  }
                : undefined
            }
            onFileAccepted={(file) => handleFileAccepted(bureau, file)}
          />
        ))}
      </div>

      {reports && reports.some((r) => r.parseStatus === "done") && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            {reports.filter((r) => r.parseStatus === "done").length} report
            {reports.filter((r) => r.parseStatus === "done").length !== 1 ? "s" : ""} parsed
            and ready for AI analysis.
          </p>
          <p className="mt-1 text-xs text-green-700">
            Proceed to the Analysis page when you are ready to identify disputable items.
          </p>
        </div>
      )}
    </div>
  );
}
