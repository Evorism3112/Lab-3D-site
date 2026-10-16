"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/lib/i18n/translations";
import { MAX_REQUEST_PHOTOS } from "@/lib/images";

export function ModelRequestClient({ dict }: { dict: Dictionary }) {
  const t = dict.requestPage;
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    if (body.getAll("photos").filter((f) => f instanceof File && f.size > 0).length > MAX_REQUEST_PHOTOS) {
      setError(t.tooManyPhotos);
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", { method: "POST", body });
      if (!res.ok) throw new Error();
      setIsSent(true);
    } catch {
      setError(t.error);
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-text">{t.successTitle}</h1>
        <p className="mt-4 text-muted">{t.successText}</p>
        <Link href="/" className="btn btn-primary mt-8 inline-flex">
          {dict.thankYou.backHome}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold text-text">{t.title}</h1>
      <p className="mt-2 text-muted">{t.subtitle}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text">{t.name}</label>
          <input name="name" required maxLength={200} className="mt-1 w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text">{t.contact}</label>
          <input name="contact" required minLength={3} maxLength={200} className="mt-1 w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text">{t.description}</label>
          <textarea
            name="description"
            required
            minLength={5}
            maxLength={3000}
            rows={5}
            placeholder={t.descriptionPlaceholder}
            className="mt-1 w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text">{t.photos}</label>
          <input name="photos" type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="mt-1 text-sm" />
          <p className="mt-1 text-xs text-muted">{t.photosHint}</p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={isSending} className="btn btn-primary w-full">
          {isSending ? t.sending : t.submit}
        </button>
      </form>
    </div>
  );
}
