"use client";

/**
 * BureauDropZone — drag-and-drop file upload zone for a single credit bureau.
 *
 * Per D-01: each bureau has its own distinct zone.
 * Per D-02: PDF only (application/pdf).
 * Per D-03: idle → uploading → parsing → done | failed | image_only.
 * Per D-04: independent upload — each bureau handled separately.
 * Per D-05: shows previous upload date and re-upload option.
 * Per D-17: image_only status shows a specific warning.
 */
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";

export type Bureau = "experian" | "equifax" | "transunion";
export type LocalStatus = "idle" | "uploading" | "parsing" | "done" | "failed" | "image_only";

export interface ExistingReport {
  uploadedAt: number;
  parseStatus: string;
  errorMessage?: string;
  confidence?: number;
}

interface BureauDropZoneProps {
  bureau: Bureau;
  localStatus: LocalStatus;
  existingReport?: ExistingReport;
  onFileAccepted: (file: File) => void;
}

const BUREAU_LABELS: Record<Bureau, string> = {
  experian: "Experian",
  equifax: "Equifax",
  transunion: "TransUnion",
};

const BUREAU_COLORS: Record<Bureau, string> = {
  experian: "border-red-400 hover:border-red-500",
  equifax: "border-blue-400 hover:border-blue-500",
  transunion: "border-cyan-400 hover:border-cyan-500",
};

const BUREAU_BADGE_COLORS: Record<Bureau, string> = {
  experian: "bg-red-100 text-red-800",
  equifax: "bg-blue-100 text-blue-800",
  transunion: "bg-cyan-100 text-cyan-800",
};

function StatusBadge({ status }: { status: LocalStatus }) {
  const configs: Record<LocalStatus, { label: string; className: string }> = {
    idle: { label: "Ready", className: "bg-gray-100 text-gray-600" },
    uploading: { label: "Uploading…", className: "bg-yellow-100 text-yellow-800" },
    parsing: { label: "Parsing…", className: "bg-blue-100 text-blue-800" },
    done: { label: "Done", className: "bg-green-100 text-green-800" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800" },
    image_only: { label: "Cannot Process", className: "bg-orange-100 text-orange-800" },
  };
  const { label, className } = configs[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function BureauDropZone({
  bureau,
  localStatus,
  existingReport,
  onFileAccepted,
}: BureauDropZoneProps) {
  const isActive = localStatus === "uploading" || localStatus === "parsing";
  const isDone = localStatus === "done";
  const isImageOnly = localStatus === "image_only";
  const isFailed = localStatus === "failed";

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0 && !isActive) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted, isActive]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: isActive,
  });

  const uploadedDate = existingReport
    ? new Date(existingReport.uploadedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`rounded-md px-3 py-1 text-sm font-semibold ${BUREAU_BADGE_COLORS[bureau]}`}>
          {BUREAU_LABELS[bureau]}
        </span>
        <StatusBadge status={localStatus} />
      </div>

      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center
          transition-colors duration-150 cursor-pointer
          ${isActive ? "cursor-not-allowed opacity-60" : ""}
          ${isDragActive ? "bg-gray-50 border-gray-400" : BUREAU_COLORS[bureau]}
          ${isDone ? "border-green-400" : ""}
          ${isFailed || isImageOnly ? "border-red-400" : ""}
        `}
      >
        <input {...getInputProps()} />

        {localStatus === "idle" && (
          <>
            <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-600">
              {isDragActive ? "Drop PDF here" : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-xs text-gray-400">PDF files only</p>
          </>
        )}

        {(localStatus === "uploading" || localStatus === "parsing") && (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-600">
              {localStatus === "uploading" ? "Uploading…" : "Parsing report…"}
            </p>
          </div>
        )}

        {localStatus === "done" && (
          <div className="flex flex-col items-center gap-1">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-700">Report parsed successfully</p>
            {existingReport?.confidence !== undefined && (
              <p className="text-xs text-gray-500">
                Confidence: {Math.round(existingReport.confidence * 100)}%
              </p>
            )}
          </div>
        )}

        {localStatus === "failed" && (
          <div className="flex flex-col items-center gap-1">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <p className="text-sm font-medium text-red-700">Parsing failed</p>
            <p className="text-xs text-gray-500">Drop a new PDF to retry</p>
          </div>
        )}

        {localStatus === "image_only" && (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium text-orange-700">Cannot process this PDF</p>
            <p className="text-xs text-gray-600 max-w-xs">
              This appears to be a scanned image PDF. Please download a text-based report from{" "}
              <span className="font-medium">annualcreditreport.com</span> and upload that instead.
            </p>
          </div>
        )}
      </div>

      {existingReport && uploadedDate && localStatus !== "uploading" && localStatus !== "parsing" && (
        <p className="text-xs text-gray-500">
          Last uploaded: {uploadedDate}
          {localStatus === "idle" && " — drop a new PDF to replace"}
        </p>
      )}
    </div>
  );
}
