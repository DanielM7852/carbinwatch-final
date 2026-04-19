"use client";

import { useCallback, useEffect, useState } from "react";

/** Override env URL when ngrok (or your tunnel) rotates domains without a Vercel redeploy. */
const STORAGE_KEY = "carbinwatcher-webcam-url";

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) return `https://${t}`;
  return t.replace(/\/+$/, "");
}

type LiveWebcamProps = {
  /** Shorter video area so stats + feed fit on tablet screens. */
  compact?: boolean;
};

export default function LiveWebcam({ compact = false }: LiveWebcamProps) {
  const envUrl = normalizeUrl(process.env.NEXT_PUBLIC_WEBCAM_URL ?? "");
  const [streamUrl, setStreamUrl] = useState(envUrl);
  const [draft, setDraft] = useState(envUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imgTick, setImgTick] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgOk, setImgOk] = useState(false);
  const [streamHint, setStreamHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const fromStorage = stored ? normalizeUrl(stored) : "";
      if (fromStorage) {
        setStreamUrl(fromStorage);
        setDraft(fromStorage);
      }
    } catch {
      /* private mode / blocked storage */
    }
  }, []);

  const saveUrl = useCallback(() => {
    const n = normalizeUrl(draft);
    try {
      if (n) {
        window.localStorage.setItem(STORAGE_KEY, n);
        setStreamUrl(n);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        setStreamUrl(envUrl);
        setDraft(envUrl);
      }
    } catch {
      setStreamUrl(n || envUrl);
    }
    setSettingsOpen(false);
    setImgTick((x) => x + 1);
  }, [draft, envUrl]);

  const reloadFrame = useCallback(() => {
    setImgTick((x) => x + 1);
  }, []);

  const activeUrl = streamUrl;
  /** Same-origin proxy adds ngrok skip header (plain img requests cannot). */
  const src = activeUrl
    ? `/api/webcam?upstream=${encodeURIComponent(activeUrl)}&_cw=${imgTick}`
    : "";

  useEffect(() => {
    setImgFailed(false);
    setImgOk(false);
  }, [activeUrl, imgTick]);

  useEffect(() => {
    if (!activeUrl) {
      setStreamHint(null);
      return;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/webcam?check=1&upstream=${encodeURIComponent(activeUrl)}`,
          { signal: ac.signal }
        );
        const data = (await res.json()) as {
          hint?: string;
          upstreamStatus?: number;
          ngrokErrorCode?: string | null;
        };
        setStreamHint(data.hint ?? null);
      } catch {
        if (!ac.signal.aborted) setStreamHint(null);
      }
    })();
    return () => ac.abort();
  }, [activeUrl, imgTick]);

  /** Don&apos;t cover a working frame; do show when probe says tunnel down before img fires. */
  const showErrorOverlay = !imgOk && (Boolean(streamHint) || imgFailed);

  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden flex flex-col min-h-0 ${compact ? "h-full" : ""}`}
      aria-label="Live camera"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-800 shrink-0">
        <div>
          <h2 className="text-zinc-400 text-[11px] uppercase tracking-widest">Live camera</h2>
          {!compact && (
            <p className="text-zinc-600 text-xs mt-0.5">
              MJPEG or snapshot URL (e.g. ngrok → your Arduino / ESP32 stream)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeUrl && (
            <button
              type="button"
              onClick={reloadFrame}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition"
            >
              Reload
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(activeUrl || envUrl);
              setSettingsOpen((v) => !v);
            }}
            className="text-xs text-emerald-400/90 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-900/80 hover:border-emerald-700/80 transition"
          >
            {settingsOpen ? "Close" : "Set URL"}
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="px-3 py-2.5 bg-zinc-950/50 border-b border-zinc-800 space-y-2 shrink-0">
          <label className="block text-xs text-zinc-500">Stream URL (saved in this browser)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://xxxx.ngrok-free.app/stream"
              className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={saveUrl}
              className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 transition"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Use the full URL to your <strong className="text-zinc-500">MJPEG or JPEG</strong> endpoint (not
            just the ngrok homepage). Clear the field and save to fall back to{" "}
            <code className="text-zinc-500">NEXT_PUBLIC_WEBCAM_URL</code>.
          </p>
        </div>
      )}

      <div
        className={`relative bg-black shrink-0 ${
          compact ? "aspect-video max-h-[min(42vh,220px)] md:max-h-[min(38vh,260px)]" : "aspect-video"
        }`}
      >
        {src ? (
          <>
            <img
              key={src}
              src={src}
              alt="Live webcam stream"
              className="absolute inset-0 w-full h-full object-contain"
              onLoad={() => {
                setImgOk(true);
                setImgFailed(false);
              }}
              onError={() => {
                setImgOk(false);
                setImgFailed(true);
              }}
            />
            {showErrorOverlay && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/88 p-4 text-center overflow-y-auto">
                <p className="text-amber-200/90 text-sm font-medium">
                  {streamHint ? "Camera / tunnel issue" : "Could not load stream"}
                </p>
                {streamHint ? (
                  <p className="text-zinc-300 text-xs mt-3 max-w-md leading-relaxed">{streamHint}</p>
                ) : (
                  <p className="text-zinc-500 text-xs mt-2 max-w-sm leading-relaxed">
                    The tunnel root often returns HTML, not a JPEG/MJPEG. Append your board&apos;s path
                    (e.g. <code className="text-zinc-400">/stream</code>,{" "}
                    <code className="text-zinc-400">/capture</code>) in{" "}
                    <span className="text-zinc-400">Set URL</span>. Open the same URL in a new tab to
                    see what it serves.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <p className="text-zinc-500 text-sm max-w-md">
              No camera URL yet. Set{" "}
              <code className="text-zinc-400 text-xs">NEXT_PUBLIC_WEBCAM_URL</code> on Vercel (or click{" "}
              <span className="text-zinc-400">Set URL</span>) and point it at your ngrok tunnel to the
              device that serves the stream.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
