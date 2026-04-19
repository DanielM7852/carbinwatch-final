import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Avoid ngrok free-tier HTML interstitial (breaks img tags pointing at ngrok). */
const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
  "User-Agent": "CarbinWatcher-WebcamProxy/1.0",
} as const;

function isAllowedUpstreamHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h.endsWith(".ngrok-free.dev") ||
    h.endsWith(".ngrok-free.app") ||
    h.endsWith(".ngrok.io") ||
    h.endsWith(".ngrok.app")
  ) {
    return true;
  }
  const extra = process.env.WEBCAM_UPSTREAM_ALLOW_HOST?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra?.length && extra.some((x) => h === x || h.endsWith(`.${x}`))) {
    return true;
  }
  return process.env.NODE_ENV === "development" && (h === "localhost" || h === "127.0.0.1");
}

function resolveUpstream(request: NextRequest): { ok: true; url: URL } | { ok: false; response: NextResponse } {
  const param = request.nextUrl.searchParams.get("upstream")?.trim();
  const fromEnv =
    process.env.NEXT_PUBLIC_WEBCAM_URL?.trim() || process.env.WEBCAM_UPSTREAM_URL?.trim();
  const target = param ? decodeURIComponent(param) : fromEnv ?? "";

  if (!target) {
    return { ok: false, response: NextResponse.json({ error: "No webcam URL configured" }, { status: 503 }) };
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid upstream URL" }, { status: 400 }) };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, response: NextResponse.json({ error: "Only http(s) upstream allowed" }, { status: 400 }) };
  }

  if (!isAllowedUpstreamHostname(url.hostname)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upstream host not allowed (use ngrok or WEBCAM_UPSTREAM_ALLOW_HOST)" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, url };
}

/** Lightweight probe: headers only, closes body — for UI hints (tunnel down, wrong path). */
export async function GET(request: NextRequest) {
  const resolved = resolveUpstream(request);
  if (!resolved.ok) return resolved.response;

  const { url } = resolved;

  if (request.nextUrl.searchParams.get("check") === "1") {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { ...NGROK_HEADERS },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({
        ok: false,
        upstreamStatus: 0,
        contentType: null as string | null,
        ngrokErrorCode: null as string | null,
        hint: `Could not reach tunnel: ${msg}`,
      });
    }

    const contentType = res.headers.get("Content-Type");
    const ngrokErrorCode = res.headers.get("Ngrok-Error-Code");
    try {
      res.body?.cancel();
    } catch {
      /* ignore */
    }

    let hint: string | undefined;
    if (res.status === 503 || ngrokErrorCode) {
      hint =
        "Ngrok says this tunnel is offline or the URL is wrong. On the PC running ngrok, start `ngrok http <camera-port>`, copy the new https URL, and paste it here (free tunnels change when ngrok restarts).";
    } else if (!res.ok) {
      hint = `Camera URL returned HTTP ${res.status}. Open this URL in a new tab and add the path your firmware uses for MJPEG/JPEG (often /stream, /capture, /mjpeg).`;
    } else if (
      contentType &&
      !/^image\//i.test(contentType) &&
      !/multipart\/x-mixed-replace/i.test(contentType) &&
      !/application\/octet-stream/i.test(contentType)
    ) {
      hint = `Got Content-Type "${contentType}" — point to the image stream path, not an HTML page.`;
    }

    return NextResponse.json({
      ok: res.ok,
      upstreamStatus: res.status,
      contentType,
      ngrokErrorCode,
      hint,
    });
  }

  const res = await fetch(url.toString(), {
    headers: { ...NGROK_HEADERS },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${res.status}` },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
