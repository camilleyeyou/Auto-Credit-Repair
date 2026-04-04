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
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  BureauDropZone,
  type Bureau,
  type LocalStatus,
} from "@/components/upload/BureauDropZone";

/** Shape of a credit_reports document as returned by listByUser. */
interface CreditReport {
  _id: Id<"credit_reports">;
  _creationTime: number;
  userId: string;
  bureau: Bureau;
  storageId: Id<"_storage">;
  uploadedAt: number;
  parseStatus: "uploaded" | "parsing" | "done" | "failed" | "image_only";
  parsedData?: unknown;
  rawText?: string;
  errorMessage?: string;
  confidence?: number;
  analysisStatus?: "not_analyzed" | "analyzing" | "analyzed" | "analysis_failed";
  analysisErrorMessage?: string;
}

const BUREAUS: Bureau[] = ["experian", "equifax", "transunion"];

export default function UploadPage() {
  const generateUploadUrl = useMutation(api.creditReports.generateUploadUrl);
  const saveReport = useMutation(api.creditReports.saveReport);
  const parseReport = useAction(api.creditReports.parseReport);
  const analyzeReport = useAction(api.creditReports.analyzeReport);
  const router = useRouter();
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
        const bureauReports = (reports as CreditReport[])
          .filter((r: CreditReport) => r.bureau === bureau)
          .sort((a: CreditReport, b: CreditReport) => b.uploadedAt - a.uploadedAt);
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

  const handleAnalyze = useCallback(
    async (reportId: Id<"credit_reports">) => {
      try {
        await analyzeReport({ reportId });
        router.push("/disputes");
      } catch (err) {
        console.error("Analysis error:", err);
      }
    },
    [analyzeReport, router]
  );

  const latestByBureau = BUREAUS.reduce<Record<Bureau, CreditReport | undefined>>(
    (acc, bureau) => {
      if (!reports) {
        acc[bureau] = undefined;
        return acc;
      }
      const sorted = (reports as CreditReport[])
        .filter((r: CreditReport) => r.bureau === bureau)
        .sort((a: CreditReport, b: CreditReport) => b.uploadedAt - a.uploadedAt);
      acc[bureau] = sorted[0];
      return acc;
    },
    {} as Record<Bureau, CreditReport | undefined>
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

      {reports && (reports as CreditReport[]).some((r: CreditReport) => r.parseStatus === "done") && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">AI Analysis</h2>
          {(reports as CreditReport[])
            .filter((r: CreditReport) => r.parseStatus === "done")
            .sort((a: CreditReport, b: CreditReport) => b.uploadedAt - a.uploadedAt)
            .map((report: CreditReport) => (
              <div
                key={report._id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {report.bureau}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(report.uploadedAt).toLocaleDateString()}
                  </span>
                  {/* Analysis status display */}
                  {report.analysisStatus === "analyzing" && (
                    <span className="ml-2 text-xs text-blue-600 animate-pulse">
                      Analyzing with AI...
                    </span>
                  )}
                  {report.analysisStatus === "analyzed" && (
                    <span className="ml-2 text-xs font-medium text-green-700">
                      &#10003; Analysis complete
                    </span>
                  )}
                  {report.analysisStatus === "analysis_failed" && (
                    <span className="ml-2 text-xs text-red-600">
                      {report.analysisErrorMessage ?? "Analysis failed"}
                    </span>
                  )}
                </div>

                {/* Analyze button — only for parsed reports not yet analyzed */}
                {report.analysisStatus === "analyzed" ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    Analysis complete
                  </span>
                ) : (
                  <button
                    onClick={() => handleAnalyze(report._id)}
                    disabled={report.analysisStatus === "analyzing"}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {report.analysisStatus === "analyzing"
                      ? "Analyzing..."
                      : report.analysisStatus === "analysis_failed"
                      ? "Retry Analysis"
                      : "Analyze Report"}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
