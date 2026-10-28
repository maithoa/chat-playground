export function getSessionId(): string {
  const STORAGE_KEY = "llm-playground-session-id";

  let sessionId = sessionStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}

export async function getDeviceFingerprint(): Promise<string> {
  const LC_STORAGE_KEY = "llm-playground-lc-storage-id";

  const cachedFpv = localStorage.getItem(LC_STORAGE_KEY);
  if (cachedFpv) {
    return cachedFpv;
  }

  const clientComponents = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || "unknown",
  ];

  const rawString = clientComponents.join("||");

  const encoder = new TextEncoder();
  const data = encoder.encode(rawString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  localStorage.setItem(LC_STORAGE_KEY, fingerprint);
  return fingerprint;
}
