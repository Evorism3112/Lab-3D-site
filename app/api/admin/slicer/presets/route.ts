import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { BambuddyError } from "@/lib/bambuddy";
import { getSlicerPresets } from "@/lib/slicing";

// Bambuddy's slicer presets for the admin's pick (admin → Prices → slicer).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const presets = await getSlicerPresets(request.nextUrl.searchParams.has("refresh"));
    return NextResponse.json({ presets });
  } catch (err) {
    const message = err instanceof BambuddyError ? err.message : "Bambuddy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
