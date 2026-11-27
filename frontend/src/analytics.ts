const preferenceKey = "playground-analytics-consent";
const visitorKey = "playground-analytics-visitor";
const appHost = "chat.maitools.space";
const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
const host = import.meta.env.VITE_POSTHOG_HOST?.trim();

type Button =
  | "open_single_chat"
  | "open_duo_arena"
  | "send_message"
  | "run_both"
  | "stop_single_chat"
  | "stop_duo_arena";
let visitRecorded = false;

export const analyticsAvailable = Boolean(
  token && host && window.location.hostname === appHost
);

export function analyticsPreference() {
  try {
    return localStorage.getItem(preferenceKey);
  } catch {
    return null;
  }
}

export function setAnalyticsPreference(allowed: boolean) {
  try {
    localStorage.setItem(preferenceKey, allowed ? "yes" : "no");
    if (!allowed) {
      localStorage.removeItem(visitorKey);
      visitRecorded = false;
    }
  } catch {
    // Storage availability must not affect chat.
  }
}

function capture(
  event: "chat_playground_visit" | "chat_playground_action",
  button?: Button
) {
  if (!analyticsAvailable || analyticsPreference() !== "yes") return;
  try {
    let visitor = localStorage.getItem(visitorKey);
    if (!visitor) {
      visitor = crypto.randomUUID();
      localStorage.setItem(visitorKey, visitor);
    }
    const payload = JSON.stringify({
      api_key: token,
      event,
      timestamp: new Date().toISOString(),
      properties: {
        distinct_id: visitor,
        app_host: appHost,
        $process_person_profile: false,
        $geoip_disable: true,
        ...(button ? { button } : {}),
      },
    });
    return fetch(new URL("/i/v0/e/", host), {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).then(
      (response) => response.ok,
      () => false
    );
  } catch {
    return;
  }
}

export function recordVisit() {
  if (visitRecorded) return;
  const request = capture("chat_playground_visit");
  if (request) {
    visitRecorded = true;
    void request.then((ok) => {
      if (!ok) visitRecorded = false;
    });
  }
}

export function recordAction(button: Button) {
  recordVisit();
  void capture("chat_playground_action", button);
}
