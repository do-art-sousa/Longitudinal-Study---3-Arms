import { useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Tick interval — how often we tell the backend the child is still on the page. */
const HEARTBEAT_INTERVAL_MS = 60_000;

/** Cap each individual fetch so a flaky tablet Wi-Fi doesn't pile up requests. */
const HEARTBEAT_FETCH_TIMEOUT_MS = 8_000;

/**
 * Pings /api/study/session/heartbeat/ once a minute while a session is active,
 * AND while the document is visible. The backend uses this to keep
 * `last_activity_at` fresh, so silent reading or activity-sheet writing won't
 * trip the inactivity lock (STUDY_INACTIVITY_SECONDS).
 *
 * @param {object} args
 * @param {string|undefined} args.studySessionId
 * @param {string|undefined} args.authToken
 * @param {boolean}          args.enabled         If false, the loop never runs.
 */
export function useStudyHeartbeat({ studySessionId, authToken, enabled = true }) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !studySessionId || !authToken) return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      // Don't waste a request when the tablet is asleep or the tab is hidden.
      if (typeof document !== "undefined" && document.hidden) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new DOMException("timeout", "AbortError")),
        HEARTBEAT_FETCH_TIMEOUT_MS,
      );
      try {
        await fetch(`${API_URL}/api/study/session/heartbeat/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            studySessionId,
            // Tell the backend "60s of activity since last beat". The server
            // caps this with STUDY_HEARTBEAT_MAX_DELTA_SECONDS so we never
            // accumulate too much when the tab is suspended mid-session.
            activeDeltaSeconds: 60,
          }),
          signal: controller.signal,
        });
      } catch {
        // Silent — the loop will retry next tick. We never surface a heartbeat
        // network failure to the child; the next chat send will reveal real
        // connectivity issues with a clearer UI.
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // First beat immediately (refresh activity right after the page mounts),
    // then every 60s.
    tick();
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [studySessionId, authToken, enabled]);
}
