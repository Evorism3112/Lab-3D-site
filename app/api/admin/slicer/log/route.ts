import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSliceLog } from "@/lib/slicing";

// The latest slices (customer quotes and test cubes) for admin → Prices → slicer.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ log: getSliceLog() });
}
