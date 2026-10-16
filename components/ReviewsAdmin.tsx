"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Dictionary } from "@/lib/i18n/translations";

type ReviewDto = {
  id: string;
  author: string;
  text: string;
  sourceUrl: string | null;
};

const EMPTY = { author: "", text: "", sourceUrl: "" };

export function ReviewsAdmin({ reviews, dict }: { reviews: ReviewDto[]; dict: Dictionary }) {
  const t = dict.admin;
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setIsSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Save failed");
      return;
    }
    setForm(EMPTY);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  };

  return (
    <div>
      <form onSubmit={handleAdd} className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">{t.reviewAuthorLabel}</label>
            <input
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              maxLength={100}
              required
              className="px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <label className="text-xs text-muted">{t.reviewSourceLabel}</label>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="https://vk.com/…"
              className="px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t.reviewTextLabel}</label>
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            maxLength={2000}
            rows={3}
            required
            className="px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={isSaving} className="btn btn-primary px-4 py-1.5 text-sm">
            {isSaving ? t.saving : t.addReview}
          </button>
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {reviews.map((review) => (
          <div key={review.id} className="card flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="whitespace-pre-line text-sm text-text">{review.text}</p>
              <p className="mt-2 text-xs text-muted">
                {review.author}
                {review.sourceUrl && (
                  <>
                    {" · "}
                    <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      {review.sourceUrl}
                    </a>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(review.id)}
              disabled={deletingId === review.id}
              className="btn btn-outline shrink-0 px-2.5 py-1 text-xs"
            >
              {t.deleteReview}
            </button>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-muted">{t.noReviews}</p>}
      </div>
    </div>
  );
}
