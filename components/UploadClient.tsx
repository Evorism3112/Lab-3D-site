import Link from "next/link";

import { UploadDropzone } from "@/components/UploadDropzone";
import type { Dictionary } from "@/lib/i18n/translations";

export function UploadClient({ dict }: { dict: Dictionary }) {
  const t = dict.upload;
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-text">{t.title}</h1>
      <UploadDropzone dict={dict} className="mt-8" />

      <div className="mt-6 flex flex-col gap-2 text-sm">
        {/* A plain link: prefetching the route would create the sample file on every page view. */}
        <a href="/order/sample" className="text-muted transition-colors hover:text-accent">
          {t.trySample} →
        </a>
        <Link href="/order/request" className="text-muted transition-colors hover:text-accent">
          {t.noModel} →
        </Link>
      </div>
    </div>
  );
}
