import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { startTestSlice } from "@/lib/slicing";

// Queues a test cube through the same path customer models take; the result shows up in the log.
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const error = await startTestSlice();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
