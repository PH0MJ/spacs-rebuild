import { hydrate } from "@/lib/db";
import { getStore } from "@/lib/store";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

// Public: live portal branding for the share page.
export async function GET() {
  await hydrate();
  const store = getStore();
  return json({ data: store.portalSetting });
}
