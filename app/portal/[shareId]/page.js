"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { http } from "@/lib/http";
import { Icon } from "@/components/icons";

const FALLBACK = {
  logoUrl: null,
  title: "بوابة الفحوصات الطبية",
  description: "مرحباً بك في بوابة عرض الفحوصات الطبية الآمنة.",
  redirectDelay: 3,
  footerText: "جميع الحقوق محفوظة",
};

export default function PortalPage() {
  const { shareId } = useParams();
  const router = useRouter();
  const { ready, setSession } = useSession();
  const [settings, setSettings] = useState(FALLBACK);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const s = await http("/portal-settings");
      if (s.ok) setSettings(s.data.data || FALLBACK);
      const res = await http(`/study-shares/${encodeURIComponent(decodeURIComponent(shareId))}/generate-token`, { method: "POST" });
      if (cancelled) return;
      if (!res.ok) {
        setFailed(true);
        const m = res.data?.message || "";
        setSettings((prev) => ({ ...prev, description: m.includes("expired") ? "عذراً، لقد انتهت الصلاحية الزمنية المحددة لرابط المشاركة هذا." : "رابط المشاركة الموفر غير صالح، أو تم إلغاؤه من قبل طبيبك المعالج." }));
        return;
      }
      const { token, user, studyInstanceUid } = res.data;
      setSession(token, user);
      const delay = settings.redirectDelay ?? 3;
      if (delay <= 0) { router.push(`/studies/${encodeURIComponent(studyInstanceUid)}/viewer`); return; }
      const total = delay * 1000;
      const started = Date.now();
      const t = setInterval(() => {
        const p = Math.min(100, ((Date.now() - started) / total) * 100);
        setProgress(p);
        if (p >= 100) { clearInterval(t); router.push(`/studies/${encodeURIComponent(studyInstanceUid)}/viewer`); }
      }, 50);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [ready, shareId]);

  return (
    <div dir="rtl" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(to bottom, #060a14, #0a1020)" }}>
      <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: "40px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {failed ? (
            <span className="badge danger" style={{ width: 68, height: 68, borderRadius: 18, display: "grid", placeItems: "center" }}><Icon name="x" size={34} /></span>
          ) : settings.logoUrl ? (
            <img src={settings.logoUrl.startsWith("data:") ? settings.logoUrl : `/storage/${settings.logoUrl}`} alt="logo" style={{ maxHeight: 90 }} />
          ) : (
            <span className="grad-text" style={{ fontSize: 34, fontWeight: 900 }}>sPACS</span>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{settings.title}</h1>
          <p className="muted" style={{ fontSize: 14 }}>{settings.description}</p>
          {!failed ? (
            <div style={{ width: "100%", maxWidth: 300 }}>
              <div style={{ height: 8, background: "var(--surface-subtle)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--brand)", transition: "width .1s linear" }} />
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>{Math.round(progress)}%</div>
              <p className="muted tiny" style={{ marginTop: 14 }}>جاري التحقق من رابط المشاركة…</p>
            </div>
          ) : (
            <a className="btn" href="/">العودة للرئيسية</a>
          )}
        </div>
        <div style={{ marginTop: 26, borderTop: "1px solid var(--surface-border)", paddingTop: 12 }}>
          <div className="tiny muted">{settings.footerText}</div>
          <div className="tiny muted2">© {new Date().getFullYear()} Techport. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
