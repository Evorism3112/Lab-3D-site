"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/lib/i18n/translations";

// The model drop zone: on the upload page and right in the home page hero. A file dropped
// anywhere on the page is taken too, not only on the zone itself.
export function UploadDropzone({ dict, className = "" }: { dict: Dictionary; className?: string }) {
  const t = dict.upload;
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/files", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          setError(data.file?.errorMessage ?? data.error ?? t.errorFallback);
          setIsUploading(false);
          return;
        }

        router.push(`/order/configure/${data.file.id}`);
      } catch {
        setError(t.errorFallback);
        setIsUploading(false);
      }
    },
    [router, t.errorFallback],
  );

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setIsDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) void uploadFile(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadFile]);

  return (
    <div className={className}>
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center border-4 border-dashed border-accent bg-bg/85 backdrop-blur-sm">
          <p className="font-display text-2xl font-semibold text-accent">{t.dropTitle}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={`flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors disabled:cursor-wait ${
          isDragging ? "border-accent bg-accent/20" : "border-accent/45 bg-accent-soft hover:border-accent"
        }`}
      >
        {isUploading ? (
          <span className="text-muted">{t.uploading}</span>
        ) : (
          <>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="text-accent">
              <path d="M12 15V4" />
              <path d="M7.5 8.5L12 4l4.5 4.5" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            <span className="font-display text-xl font-semibold text-text">{t.dropTitle}</span>
            <span className="text-[15px] text-muted">{t.dropSubtitle}</span>
            <span className="font-mono text-xs text-muted">{t.subtitle}</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
