"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      const { id } = (await res.json()) as { id: string };
      router.push(`/project/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="row">
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/*" required />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload & edit"}
      </button>
      <span className="dim">1–15 min talking-head video · 9:16 output · MP4 in, MP4 out</span>
      {error ? <span className="error-text">{error}</span> : null}
    </form>
  );
}
