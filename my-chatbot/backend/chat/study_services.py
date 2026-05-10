"""
Study schedule unlocking, session wall-clock lock, and personalized memory updates.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .models import Conversation, Participant, StudySession
from .study_config import get_profile


def participant_from_token(token: Optional[str]) -> Optional[Participant]:
    if not token:
        return None
    t = str(token).strip()
    if not t:
        return None
    return Participant.objects.filter(auth_token=t).first()


def study_now():
    tz_name = getattr(settings, "STUDY_TIMEZONE", "UTC")
    try:
        import zoneinfo

        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    return timezone.now().astimezone(tz)


def study_start_datetime() -> datetime:
    """Timezone-aware start of the study in the study timezone."""
    tz_name = getattr(settings, "STUDY_TIMEZONE", "UTC")
    try:
        import zoneinfo

        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    date_str = getattr(settings, "STUDY_START_DATE", "2026-01-01")
    try:
        y, m, d = (int(x) for x in date_str.split("-", 2))
        return datetime(y, m, d, 0, 0, 0, tzinfo=tz)
    except Exception:
        return datetime(2026, 1, 1, 0, 0, 0, tzinfo=tz)


def released_week_index() -> int:
    """
    1-based week index of the last released study week.
    0 = before study start, no weeks released.
    """
    now = study_now()
    start = study_start_datetime()
    if now < start:
        return 0
    delta_days = (now.date() - start.date()).days
    return delta_days // 7 + 1


def total_study_weeks() -> int:
    return max(1, int(getattr(settings, "STUDY_TOTAL_WEEKS", 3)))


def global_session_index(week_index: int, slot_index: int) -> int:
    """1-based session number: 3 slots per week (e.g. week 2 slot 3 → 6)."""
    return (int(week_index) - 1) * 3 + int(slot_index)


def rcq_required_for_global_index(global_index: int) -> bool:
    """RCQ after sessions 1 (baseline), 3, 6, and 9."""
    return global_index in (1, 3, 6, 9)


REQ_SCORE_KEYS = (
    "social_presence",
    "connection",
    "responsiveness",
    "autonomy",
    "motivation",
    "latent_demand",
    "unmet_need",
    "isolation",
)


def validate_req_scores(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    for key in REQ_SCORE_KEYS:
        v = data.get(key)
        if type(v) is not int or v < 1 or v > 5:
            return False
    return True


def bootstrap_study_sessions(participant: Participant) -> None:
    """Create locked rows for all week/slot combinations if missing."""
    weeks = total_study_weeks()
    to_create: List[StudySession] = []
    existing = set(
        StudySession.objects.filter(participant=participant).values_list(
            "week_index", "slot_index"
        )
    )
    for w in range(1, weeks + 1):
        for s in range(1, 4):
            if (w, s) not in existing:
                to_create.append(
                    StudySession(
                        participant=participant,
                        week_index=w,
                        slot_index=s,
                        status=StudySession.Status.LOCKED,
                    )
                )
    if to_create:
        StudySession.objects.bulk_create(to_create)


def ordered_sessions(participant: Participant):
    return list(
        StudySession.objects.filter(participant=participant).order_by(
            "week_index", "slot_index"
        )
    )


## Custom spacing rule (Study D protocol).
## - Sessions 1, 2 and 3 must each fall on a different calendar day in the
##   study timezone (i.e. min 1 day between consecutive sessions in this trio).
## - From session 4 onwards there is no spacing requirement — once the
##   previous session is completed, the next one unlocks immediately.
SESSIONS_REQUIRING_DAY_SPACING = (2, 3)


def _study_tz():
    tz_name = getattr(settings, "STUDY_TIMEZONE", "UTC")
    try:
        import zoneinfo

        return zoneinfo.ZoneInfo(tz_name)
    except Exception:
        return timezone.utc


def _spacing_satisfied(prev_session: Optional[StudySession], current_g_idx: int) -> bool:
    """Whether the day-spacing rule is satisfied for `current_g_idx`.

    True when:
      - the rule is disabled by settings (STUDY_DAY_SPACING_ENFORCED=False); or
      - the rule does not apply (g_idx not in SESSIONS_REQUIRING_DAY_SPACING); or
      - the previous session's `ended_at` falls on a strictly earlier calendar
        day in the study timezone.
    """
    if not getattr(settings, "STUDY_DAY_SPACING_ENFORCED", True):
        return True
    if current_g_idx not in SESSIONS_REQUIRING_DAY_SPACING:
        return True
    if prev_session is None or not prev_session.ended_at:
        # Defensive: only called after prev session is COMPLETED; if ended_at
        # is somehow missing, allow rather than block forever.
        return True
    tz = _study_tz()
    prev_day = prev_session.ended_at.astimezone(tz).date()
    today = study_now().date()
    return today > prev_day


def refresh_session_availability(participant: Participant) -> None:
    """Apply study-start gating, strict sequential completion, and the
    sessions-2-and-3 day-spacing rule.

    For each non-IN_PROGRESS, non-COMPLETED session, in order:
      LOCKED    ← study not yet started, previous incomplete, or spacing not met
      AVAILABLE ← all gates satisfied
    """
    slots = ordered_sessions(participant)
    now = study_now()
    start_dt = study_start_datetime()
    study_started = now >= start_dt

    prev_session: Optional[StudySession] = None

    for ss in slots:
        if ss.status == StudySession.Status.COMPLETED:
            prev_session = ss
            continue
        if ss.status == StudySession.Status.IN_PROGRESS:
            # Don't change in-progress; nothing after it can unlock anyway.
            prev_session = ss
            continue

        # Decide LOCKED vs AVAILABLE for this session.
        g_idx = global_session_index(ss.week_index, ss.slot_index)

        if not study_started:
            new_status = StudySession.Status.LOCKED
        elif prev_session is None:
            # First session: only the start-date gate matters (already passed).
            new_status = StudySession.Status.AVAILABLE
        elif prev_session.status != StudySession.Status.COMPLETED:
            # Sequential gate.
            new_status = StudySession.Status.LOCKED
        elif not _spacing_satisfied(prev_session, g_idx):
            # Day-spacing rule for sessions 2 and 3.
            new_status = StudySession.Status.LOCKED
        else:
            new_status = StudySession.Status.AVAILABLE

        if ss.status != new_status:
            ss.status = new_status
            ss.save(update_fields=["status"])
        prev_session = ss


def _session_cap_seconds(participant: Participant) -> int:
    profile = get_profile(participant.condition)
    return profile.max_session_wall_minutes * 60


def wall_elapsed_seconds(ss: StudySession) -> float:
    if not ss.started_at or ss.status != StudySession.Status.IN_PROGRESS:
        return 0.0
    return max(0.0, (timezone.now() - ss.started_at).total_seconds())


def is_wall_locked(ss: StudySession, participant: Participant) -> bool:
    if ss.status != StudySession.Status.IN_PROGRESS or not ss.started_at:
        return False
    return wall_elapsed_seconds(ss) >= _session_cap_seconds(participant)


def mark_time_cap_triggered(ss: StudySession) -> None:
    if ss.time_cap_triggered_at:
        return
    ss.time_cap_triggered_at = timezone.now()
    ss.save(update_fields=["time_cap_triggered_at"])


def is_inactivity_locked(ss: StudySession) -> bool:
    threshold = int(getattr(settings, "STUDY_INACTIVITY_SECONDS", 600))
    if threshold <= 0:
        return False
    if ss.status != StudySession.Status.IN_PROGRESS or not ss.last_activity_at:
        return False
    return (timezone.now() - ss.last_activity_at).total_seconds() >= threshold


def chat_should_lock(ss: StudySession, participant: Participant) -> Optional[str]:
    """Return lock reason ('time_cap' | 'inactive_timeout') or None."""
    if ss.status != StudySession.Status.IN_PROGRESS:
        return None
    if is_wall_locked(ss, participant):
        mark_time_cap_triggered(ss)
        return "time_cap"
    if is_inactivity_locked(ss):
        return "inactive_timeout"
    return None


def touch_activity(ss: StudySession) -> None:
    ss.last_activity_at = timezone.now()
    ss.save(update_fields=["last_activity_at"])


def add_active_seconds(ss: StudySession, delta: int) -> None:
    cap = int(getattr(settings, "STUDY_HEARTBEAT_MAX_DELTA_SECONDS", 120))
    delta = max(0, min(delta, cap))
    if delta <= 0:
        return
    StudySession.objects.filter(pk=ss.pk).update(active_seconds=F("active_seconds") + delta)


def seconds_until_wall_lock(ss: StudySession, participant: Participant) -> Optional[int]:
    if ss.status != StudySession.Status.IN_PROGRESS or not ss.started_at:
        return None
    cap = _session_cap_seconds(participant)
    elapsed = wall_elapsed_seconds(ss)
    return max(0, int(cap - elapsed))


def get_current_study_session(participant: Participant) -> Optional[StudySession]:
    """Return the next session the participant should focus on.

    Priority: IN_PROGRESS > AVAILABLE > LOCKED. Returning LOCKED here too means
    the dashboard can show "next session is X, available [tomorrow]" instead of
    falsely reporting "all sessions completed" when a spacing rule is active.
    """
    for status in (
        StudySession.Status.IN_PROGRESS,
        StudySession.Status.AVAILABLE,
        StudySession.Status.LOCKED,
    ):
        nxt = (
            StudySession.objects.filter(participant=participant, status=status)
            .order_by("week_index", "slot_index")
            .first()
        )
        if nxt:
            return nxt
    return None


def next_unlock_datetime(prev_session: Optional[StudySession], current_g_idx: int):
    """If the next session is locked by the day-spacing rule, return the
    earliest datetime (study tz) at which it will unlock. None otherwise."""
    if not getattr(settings, "STUDY_DAY_SPACING_ENFORCED", True):
        return None
    if current_g_idx not in SESSIONS_REQUIRING_DAY_SPACING:
        return None
    if prev_session is None or not prev_session.ended_at:
        return None
    tz = _study_tz()
    prev_day = prev_session.ended_at.astimezone(tz).date()
    next_day = prev_day + timezone.timedelta(days=1)
    return datetime(
        next_day.year, next_day.month, next_day.day, 0, 0, 0, tzinfo=tz
    )


def progress_dict(participant: Participant) -> Dict[str, Any]:
    bootstrap_study_sessions(participant)
    refresh_session_availability(participant)
    profile = get_profile(participant.condition)
    slots = ordered_sessions(participant)
    current = get_current_study_session(participant)
    payload: Dict[str, Any] = {
        "condition": participant.condition,
        "displayName": (participant.display_name or "").strip(),
        "memoryEnabled": profile.memory_enabled,
        "maxSessionMinutes": profile.max_session_wall_minutes,
        "allowCharacterSelection": profile.allow_character_selection,
        "defaultCharacter": profile.default_character,
        "skipChat": participant.condition == Participant.Condition.CONTROL,
        "surveyInstrument": (
            "panas_req"
            if participant.condition == Participant.Condition.CONTROL
            else "caiq_panas"
        ),
        "releasedWeekIndex": released_week_index(),
        "sessions": [
            {
                "id": str(s.id),
                "weekIndex": s.week_index,
                "slotIndex": s.slot_index,
                "globalSessionIndex": global_session_index(
                    s.week_index, s.slot_index
                ),
                "status": s.status,
            }
            for s in slots
        ],
    }
    if current:
        gidx = global_session_index(current.week_index, current.slot_index)
        payload["focusSessionId"] = str(current.id)
        payload["focusWeekIndex"] = current.week_index
        payload["focusSlotIndex"] = current.slot_index
        payload["focusGlobalSessionIndex"] = gidx
        payload["focusStatus"] = current.status
        # If this session is locked specifically because of the day-spacing
        # rule, surface the earliest unlock datetime so the UI can render
        # "disponível amanhã" instead of just "bloqueada".
        if current.status == StudySession.Status.LOCKED:
            prev = (
                StudySession.objects.filter(
                    participant=participant,
                    status=StudySession.Status.COMPLETED,
                )
                .order_by("-week_index", "-slot_index")
                .first()
            )
            unlock_at = next_unlock_datetime(prev, gidx)
            if unlock_at is not None:
                payload["nextAvailableAt"] = unlock_at.isoformat()
        # True on global sessions 1, 3, 6, 9: RCQ block in PostSessionSurvey after session end.
        # Frontend may use this to cue children (e.g. open activity drawer); not a separate sheet API.
        payload["showComprehension"] = rcq_required_for_global_index(gidx)
        payload["showLikert"] = True
        if current.status == StudySession.Status.IN_PROGRESS:
            sul = seconds_until_wall_lock(current, participant)
            lock_reason = chat_should_lock(current, participant)
            payload["secondsUntilLock"] = sul
            payload["sessionLocked"] = lock_reason is not None
            payload["lockReason"] = lock_reason
            if current.started_at:
                payload["sessionStartedAt"] = current.started_at.isoformat()
        else:
            payload["secondsUntilLock"] = None
            payload["sessionLocked"] = False
            payload["lockReason"] = None
    else:
        payload["focusSessionId"] = None
        payload["message"] = "All scheduled sessions completed."
    return payload


def get_memory_context_for_chat(participant: Participant) -> str:
    profile = get_profile(participant.condition)
    if not profile.memory_enabled:
        return ""
    summary = (participant.memory_summary or "").strip()
    if not summary:
        return ""
    return (
        "\n\nWhat you already know about this reader from earlier sessions "
        f"(stay consistent; do not contradict):\n{summary}\n"
    )


def validate_likert(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    for key in ("rapport", "closeness", "flow"):
        v = data.get(key)
        if not isinstance(v, int) or v < 1 or v > 5:
            return False
    return True


def comprehension_provided(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    for v in data.values():
        if isinstance(v, str) and v.strip():
            return True
        if isinstance(v, (list, dict)) and v:
            return True
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return True
    return False


def merge_conversation_into_memory(participant: Participant, conversation: Conversation) -> None:
    if participant.condition != Participant.Condition.PERSONALIZED:
        return
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        lines = []
        for m in conversation.messages or []:
            role = m.get("sender", "")
            content = (m.get("content") or "")[:500]
            lines.append(f"{role}: {content}")
        transcript = "\n".join(lines)[:8000]
        if not transcript.strip():
            return
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Summarize in 2-4 short sentences what the child shared about their "
                        "reading (books, reactions, interests). No PII beyond what is in the text. "
                        "English or Portuguese is fine."
                    ),
                },
                {"role": "user", "content": transcript},
            ],
            temperature=0.3,
            max_tokens=200,
        )
        chunk = (completion.choices[0].message.content or "").strip()
        if not chunk:
            return
        prev = (participant.memory_summary or "").strip()
        merged = f"{prev}\n\n---\n{chunk}".strip() if prev else chunk
        max_len = int(getattr(settings, "STUDY_MEMORY_MAX_CHARS", 6000))
        if len(merged) > max_len:
            merged = merged[-max_len:]
        participant.memory_summary = merged
        participant.save(update_fields=["memory_summary"])
    except Exception:
        return


def get_study_session_for_conversation(
    conversation_id: str, participant: Participant
) -> Optional[StudySession]:
    return (
        StudySession.objects.filter(
            participant=participant,
            conversation_id=conversation_id,
            status=StudySession.Status.IN_PROGRESS,
        )
        .first()
    )
