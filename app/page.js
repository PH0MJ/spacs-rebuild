"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";

export default function DashboardPage() {
  const { user, locale } = useSession();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hrs = now.getHours();
  const h12 = String(((hrs % 12) || 12)).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  const greeting = hrs >= 5 && hrs < 12 ? "Good morning" : hrs >= 12 && hrs < 18 ? "Good afternoon" : "Good evening";
  const initials = (user?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const dateStr = now.toLocaleDateString(locale === "ar" ? "ar" : "en", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="dash" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="avatar">{initials}</div>
      <div className="h2 grad-text">{greeting}, {user?.name || "there"}</div>
      <div className="clock"><span>{h12}</span><span className="grad-text">:</span><span>{mm}</span><span className="small muted">{ss} {ampm}</span></div>
      <div className="card pad" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span className="dot" style={{ color: "var(--brand)" }} />
        <span className="small">{dateStr}</span>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>Have a wonderful and productive day!</div>
      <div className="muted2 tiny" style={{ marginTop: 20, maxWidth: 520 }}>
        sPACS rebuild — login removed, demo session auto-established. Open <b>Studies</b> to explore the PACS,
        <b> Docs</b> for the full reverse-engineering write-up.
      </div>
    </div>
  );
}
