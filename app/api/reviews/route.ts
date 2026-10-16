import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ReviewSchema = z.object({
  author: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(2000),
  sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  const count = await prisma.review.count();
  const review = await prisma.review.create({
    data: {
      author: parsed.data.author,
      text: parsed.data.text,
      sourceUrl: parsed.data.sourceUrl || null,
      sortOrder: count,
    },
  });
  return NextResponse.json({ review }, { status: 201 });
}
