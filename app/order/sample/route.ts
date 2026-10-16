import { redirect } from "next/navigation";

import { getSampleFileId } from "@/lib/samples";

// "Try it on an example": opens the configure page for the bundled sample model.
export async function GET() {
  const fileId = await getSampleFileId();
  redirect(`/order/configure/${fileId}`);
}
