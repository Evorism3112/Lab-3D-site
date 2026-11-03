import { ReviewsAdmin } from "@/components/ReviewsAdmin";
import { prisma } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";

export default async function AdminReviewsPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.admin;

  const reviews = await prisma.review.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, author: true, text: true, sourceUrl: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t.reviewsTitle}</h1>
      <p className="mt-1 text-sm text-muted">{t.reviewsHint}</p>
      <div className="mt-6">
        <ReviewsAdmin reviews={reviews} dict={dict} />
      </div>
    </div>
  );
}
