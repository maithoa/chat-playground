import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("records visits and actions only with consent and excludes chat content", async () => {
  vi.stubEnv("VITE_POSTHOG_PROJECT_TOKEN", "test");
  vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubGlobal("location", { hostname: "chat.maitools.space" });
  const fetch = vi.fn(async (_url: URL, _request: RequestInit) => ({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const analytics = await import("./analytics");
  analytics.recordAction("send_message");
  expect(fetch).not.toHaveBeenCalled();
  analytics.setAnalyticsPreference(true);
  analytics.recordVisit();
  analytics.recordAction("send_message");
  expect(fetch).toHaveBeenCalledTimes(2);
  const [visit, action] = fetch.mock.calls.map(([, request]) =>
    JSON.parse(String(request.body))
  );
  expect(visit.event).toBe("chat_playground_visit");
  expect(action).toMatchObject({
    event: "chat_playground_action",
    properties: {
      app_host: "chat.maitools.space",
      distinct_id: visit.properties.distinct_id,
      button: "send_message",
    },
  });
  expect(Object.keys(action.properties).sort()).toEqual(
    [
      "$geoip_disable",
      "$process_person_profile",
      "app_host",
      "button",
      "distinct_id",
    ].sort()
  );
  analytics.setAnalyticsPreference(false);
  analytics.recordAction("run_both");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("playground-analytics-visitor")).toBeNull();
});
