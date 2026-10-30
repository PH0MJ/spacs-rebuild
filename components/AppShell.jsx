"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { Icon } from "./icons";

const NAV = [
  { label: "Home", href: "/", icon: "home", match: (p) => p === "/", always: true },
  { label: "Studies", href: "/studies", icon: "database", perm: "Study.view" },
  { label: "Users", href: "/users", icon: "users", perm: "User.view" },
  { label: "Roles", href: "/roles", icon: "shield", perm: "Role.view" },
  { label: "Print Templates", href: "/print-templates", icon: "printer", perm: ["PrintTemplate.listAny", "PrintTemplate.listOwn"] },
  { label: "Preferences", href: "/preferences", icon: "sliders", perm: "Preference.view" },
  { label: "PACS Settings", href: "/settings/pacs", icon: "settings", perm: "PacsSetting.view" },
  { label: "Portal Settings", href: "/settings/portal", icon: "globe", perm: "PortalSetting.view" },
  { label: "Docs", href: "/docs", icon: "file", always: true },
];

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, theme, toggleTheme, locale, setLocale, logout, hasPermission } = useSession();
  const [userMenu, setUserMenu] = useState(false);

  const fullScreen = /\/studies\/[^/]+\/(viewer|report)/.test(pathname) || pathname.startsWith("/portal/");

  useEffect(() => {
    const name = user?.name || "sPACS";
    document.title = `${name} — sPACS`;
  }, [user, pathname]);

  if (fullScreen) return <>{children}</>;
  if (!ready) {
    return (
      <div className="dash">
        <div className="brand-mark" style={{ width: 54, height: 54, fontSize: 20 }}>sP</div>
        <div className="h2">Loading sPACS…</div>
        <div className="muted small">Establishing demo session</div>
      </div>
    );
  }

  const layout = user?.preference?.navigationLayout || "sidenav";
  const items = NAV.filter((n) => n.always || hasPermission(n.perm));
  const initials = (user?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const isActive = (n) => (n.match ? n.match(pathname) : pathname.startsWith(n.href));

  const NavList = () => (
    <>
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={`nav-item ${isActive(n) ? "active" : ""}`} title={n.label}>
          <Icon name={n.icon} />
          <span className="nav-label">{n.label}</span>
        </Link>
      ))}
    </>
  );

  const Brand = () => (
    <Link href="/" className="brand">
      <span className="brand-mark">sP</span>
      <span className="brand-name">sPACS</span>
    </Link>
  );

  const UserMenu = () => (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => setUserMenu((v) => !v)} title={user?.name}>
        <span style={{ fontWeight: 800, fontSize: 12 }}>{initials}</span>
      </button>
      {userMenu ? (
        <div className="card" style={{ position: "absolute", insetInlineEnd: 0, top: 40, width: 220, padding: 8, zIndex: 50 }}>
          <div style={{ padding: "6px 8px" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.name}</div>
            <div className="muted tiny">{user?.speciality || user?.username}</div>
            <div className="wrap" style={{ marginTop: 6 }}>
              {(user?.roles || []).map((r) => <span key={r} className="badge brand tiny">{r}</span>)}
            </div>
          </div>
          <hr style={{ borderTop: "1px solid var(--surface-border)", margin: "6px 0" }} />
          <button className="nav-item" style={{ width: "100%" }} onClick={() => { setUserMenu(false); router.push("/preferences"); }}>
            <Icon name="sliders" /> <span className="nav-label">Preferences</span>
          </button>
          <button className="nav-item" style={{ width: "100%" }} onClick={async () => { await logout(); router.push("/"); }}>
            <Icon name="logout" /> <span className="nav-label">Clear demo session</span>
          </button>
        </div>
      ) : null}
    </div>
  );

  const Utilities = () => (
    <>
      <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} />
      </button>
      <button className="icon-btn" onClick={() => setLocale(locale === "en" ? "ar" : "en")} title="Language">
        <span style={{ fontWeight: 800, fontSize: 11 }}>{locale === "en" ? "AR" : "EN"}</span>
      </button>
      <UserMenu />
    </>
  );

  if (layout === "topbar") {
    return (
      <div className="shell col">
        <div className="topbar">
          <Brand />
          <div className="wrap" style={{ flexWrap: "nowrap" }}><NavList /></div>
          <div className="spacer" />
          <Utilities />
        </div>
        <div className="main"><div className="content">{children}</div></div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${layout === "compact" ? "rail" : ""}`}>
        <Brand />
        <NavList />
        <div className="spacer" />
        <div className="row" style={{ padding: "4px", justifyContent: layout === "compact" ? "center" : "space-between" }}>
          {layout !== "compact" ? <span className="tiny muted2">v1.0 demo</span> : null}
          <div className="row">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
            <UserMenu />
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="spacer" />
          <button className="icon-btn" onClick={() => setLocale(locale === "en" ? "ar" : "en")} title="Language">
            <span style={{ fontWeight: 800, fontSize: 11 }}>{locale === "en" ? "AR" : "EN"}</span>
          </button>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
