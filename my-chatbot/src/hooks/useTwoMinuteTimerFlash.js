import { useState, useEffect, useRef } from "react";

/** Wall-clock seconds left when we warn the participant once per session. */
export const SESSION_TIMER_WARNING_SEC = 120;

/** Duration of the red/white pulse animation (3 cycles). */
const FLASH_DURATION_MS = 2400;

/**
 * When remaining session time first hits {@link SESSION_TIMER_WARNING_SEC} or below,
 * triggers a one-shot visual flash (handled via CSS class). Resets per `sessionKey`.
 *
 * @param {string|undefined|null} sessionKey – e.g. studySessionId; must change between sessions.
 * @param {number|null} secondsUntilLock – countdown seconds, or null if no cap.
 */
export function useTwoMinuteTimerFlash(sessionKey, secondsUntilLock) {
  const [timerEndingFlash, setTimerEndingFlash] = useState(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    warnedRef.current = false;
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    if (secondsUntilLock === null || secondsUntilLock <= 0) return;
    if (secondsUntilLock <= SESSION_TIMER_WARNING_SEC && !warnedRef.current) {
      warnedRef.current = true;
      setTimerEndingFlash(true);
    }
  }, [secondsUntilLock, sessionKey]);

  useEffect(() => {
    if (!timerEndingFlash) return;
    const t = setTimeout(() => setTimerEndingFlash(false), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [timerEndingFlash]);

  return timerEndingFlash;
}
