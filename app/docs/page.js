"use client";
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Markdown } from "@/components/Markdown";

export default function DocsPage() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/sPACS-full-documentation.md")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("not found"))))
      .then(setText)
      .catch(() => setError("Documentation file not found."));
  }, []);

  return (
    <PageLayout
      title="Documentation"
      backTo="/"
      actions={<a className="btn sm" href="/sPACS-full-documentation.md" target="_blank" rel="noopener noreferrer">Open raw Markdown</a>}
    >
      {error ? <div className="card pad">{error}</div> : null}
      {!text && !error ? <div className="empty"><span className="spin" style={{ display: "inline-block" }} /> Loading…</div> : null}
      {text ? <div className="card pad"><Markdown text={text} /></div> : null}
    </PageLayout>
  );
}
