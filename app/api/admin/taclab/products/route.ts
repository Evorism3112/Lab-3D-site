import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional();

const ProductSchema = z.object({
  crmName: z.string().min(1).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Адрес: латиница, цифры и дефисы")
    .max(80),
  visible: z.boolean(),
  inStock: z.boolean(),
  leadTimeDays: z.number().int().min(1).max(365).nullable(),
  tagline: optionalText(300),
  description: optionalText(5000),
  specs: optionalText(3000),
  compatibility: optionalText(3000),
  kit: optionalText(2000),
  colors: z.string().max(20).regex(/^[A-Za-z]*$/),
  connectors: z.string().max(20).regex(/^[A-Za-z]*$/),
  sortOrder: z.number().int().min(0).max(10_000),
});

// Shop content of one CRM product (admin → TACLAB), created on first save.
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = ProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return NextResponse.json({ error: message && !message.startsWith("Invalid") ? message : "Проверьте поля" }, { status: 400 });
  }
  const { crmName, ...data } = parsed.data;
  const taken = await prisma.taclabProduct.findFirst({ where: { slug: data.slug, NOT: { crmName } } });
  if (taken) return NextResponse.json({ error: `Адрес «${data.slug}» уже занят «${taken.crmName}»` }, { status: 409 });

  const values = { ...data, colors: data.colors.toUpperCase(), connectors: data.connectors.toUpperCase() };
  const product = await prisma.taclabProduct.upsert({
    where: { crmName },
    update: values,
    create: { crmName, ...values },
  });
  return NextResponse.json({ product });
}
