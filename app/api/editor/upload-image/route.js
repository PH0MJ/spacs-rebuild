import { json, guard, jsonP } from "@/lib/api";

export const dynamic = "force-dynamic";

// Accepts a multipart image and returns a data-URL (demo — nothing is written to disk).
export async function POST(req) {
  const g = await guard(req, null);
  if (g.response) return g.response;
  try {
    const form = await req.formData();
    const file = form.get("image") || form.get("file") || form.get("upload");
    if (!file || typeof file === "string") return jsonP({ data: { url: null } });
    const buf = Buffer.from(await file.arrayBuffer());
    const type = file.type || "image/png";
    const base64 = `data:${type};base64,${buf.toString("base64")}`;
    return jsonP({ data: { url: base64 } });
  } catch {
    return jsonP({ data: { url: null } });
  }
}
