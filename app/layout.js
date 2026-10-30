import "./globals.css";
import { SessionProvider } from "@/components/session";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "sPACS",
  description: "Picture archiving and communication system — open-source rebuild",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#05001f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
