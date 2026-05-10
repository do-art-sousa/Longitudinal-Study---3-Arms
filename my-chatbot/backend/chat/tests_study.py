import json
import secrets

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import Conversation, Participant, StudySession
from .study_credentials import validate_pin_pair
from .study_services import (
    bootstrap_study_sessions,
    refresh_session_availability,
    validate_likert,
    comprehension_provided,
)


def _register_payload(code, display_name="Kid", pin="1234"):
    return json.dumps(
        {
            "enrollmentCode": code,
            "displayName": display_name,
            "pin": pin,
            "pinConfirm": pin,
        }
    )


REQ_SMOKE_BODY = {
    "social_presence": 3,
    "connection": 3,
    "responsiveness": 3,
    "autonomy": 3,
    "motivation": 3,
    "latent_demand": 3,
    "unmet_need": 3,
    "isolation": 3,
}


@override_settings(
    STUDY_CODES_PERSONALIZED="TEST-P",
    STUDY_CODES_GENERIC="TEST-G",
    STUDY_CODES_CONTROL="TEST-C",
    STUDY_START_DATE="1990-01-01",
    STUDY_TIMEZONE="UTC",
    STUDY_TOTAL_WEEKS=3,
    STUDY_PROFILE_PERSONALIZED_MAX_SESSION_MINUTES=20,
    STUDY_PROFILE_GENERIC_MAX_SESSION_MINUTES=20,
    STUDY_PIN_MIN_LENGTH=4,
    STUDY_PIN_MAX_LENGTH=6,
    STUDY_LOGIN_CODE_LENGTH=10,
    STUDY_ROTATE_TOKEN_ON_LOGIN=True,
    STUDY_DAY_SPACING_ENFORCED=False,
)
class StudyApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_enrollment_preview(self):
        r = self.client.get("/api/study/enrollment-preview/", {"code": "TEST-P"})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["valid"])
        self.assertEqual(data["condition"], "personalized")
        r_lower = self.client.get("/api/study/enrollment-preview/", {"code": "test-p"})
        self.assertTrue(r_lower.json()["valid"])
        self.assertEqual(r_lower.json()["condition"], "personalized")
        r2 = self.client.get("/api/study/enrollment-preview/", {"code": "nope"})
        self.assertFalse(r2.json()["valid"])

    def test_register_personalized_requires_display_name(self):
        r = self.client.post(
            "/api/study/register/",
            data=json.dumps(
                {
                    "enrollmentCode": "TEST-P",
                    "displayName": "  ",
                    "pin": "1234",
                    "pinConfirm": "1234",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("nome", r.json().get("error", "").lower())

    def test_register_invalid_code(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("BAD"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 400)

    def test_register_requires_pin(self):
        r = self.client.post(
            "/api/study/register/",
            data=json.dumps({"enrollmentCode": "TEST-P"}),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 400)

    def test_register_bootstrap_and_sequential_unlock(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-P"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        data = json.loads(r.content)
        token = data["authToken"]
        self.assertTrue(token)
        self.assertTrue(data.get("loginCode"))

        p = Participant.objects.get(auth_token=token)
        self.assertEqual(p.condition, Participant.Condition.PERSONALIZED)
        self.assertEqual(p.login_code, data["loginCode"])
        self.assertEqual(StudySession.objects.filter(participant=p).count(), 9)

        r2 = self.client.get(
            "/api/study/progress/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r2.status_code, 200)
        prog = json.loads(r2.content)
        self.assertEqual(prog["focusSlotIndex"], 1)
        self.assertEqual(prog["focusGlobalSessionIndex"], 1)
        self.assertEqual(prog["focusStatus"], "available")
        self.assertFalse(prog.get("skipChat"))
        self.assertEqual(prog.get("surveyInstrument"), "caiq_panas")

    def test_register_control_enrollment(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-C"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        data = json.loads(r.content)
        p = Participant.objects.get(auth_token=data["authToken"])
        self.assertEqual(p.condition, Participant.Condition.CONTROL)
        prog = json.loads(
            self.client.get(
                "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {data['authToken']}"
            ).content
        )
        self.assertTrue(prog.get("skipChat"))
        self.assertEqual(prog.get("surveyInstrument"), "panas_req")

    def test_start_complete_unlocks_next(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-G"),
            content_type="application/json",
        )
        token = json.loads(r.content)["authToken"]
        prog = json.loads(
            self.client.get(
                "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {token}"
            ).content
        )
        sid = prog["focusSessionId"]

        r_start = self.client.post(
            "/api/study/session/start/",
            data=json.dumps(
                {
                    "studySessionId": sid,
                    "userName": "A",
                    "character": "default",
                    "initialMessage": "Hello.",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r_start.status_code, 200)
        conv_id = json.loads(r_start.content)["conversationId"]

        r_done = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": sid,
                    "endReason": "completed_content",
                    "likert": {"rapport": 4, "closeness": 3, "flow": 5},
                    "comprehension": {"main_response": "Smoke comprehension."},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r_done.status_code, 200)

        prog2 = json.loads(
            self.client.get(
                "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {token}"
            ).content
        )
        self.assertEqual(prog2["focusSlotIndex"], 2)

    def test_slot3_requires_comprehension(self):
        p = Participant.objects.create(
            condition=Participant.Condition.GENERIC,
            auth_token=secrets.token_urlsafe(32),
            enrollment_code_used="TEST-G",
        )
        bootstrap_study_sessions(p)
        for ss in StudySession.objects.filter(participant=p):
            ss.status = StudySession.Status.COMPLETED
            ss.save()
        third = StudySession.objects.get(participant=p, week_index=1, slot_index=3)
        third.status = StudySession.Status.AVAILABLE
        third.save()
        refresh_session_availability(p)
        third.refresh_from_db()
        self.assertEqual(third.status, StudySession.Status.AVAILABLE)

        convo = Conversation.objects.create(
            user_name="A",
            character="default",
            participant=p,
        )
        third.conversation = convo
        third.status = StudySession.Status.IN_PROGRESS
        third.started_at = timezone.now()
        third.last_activity_at = timezone.now()
        third.save()

        r = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": str(third.id),
                    "endReason": "completed_content",
                    "likert": {"rapport": 4, "closeness": 3, "flow": 5},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {p.auth_token}",
        )
        self.assertEqual(r.status_code, 400)

        r_ok = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": str(third.id),
                    "endReason": "completed_content",
                    "likert": {"rapport": 4, "closeness": 3, "flow": 5},
                    "comprehension": {"main_response": "I understood the plot."},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {p.auth_token}",
        )
        self.assertEqual(r_ok.status_code, 200)

    def test_global_session6_requires_comprehension(self):
        p = Participant.objects.create(
            condition=Participant.Condition.GENERIC,
            auth_token=secrets.token_urlsafe(32),
            enrollment_code_used="TEST-G",
        )
        bootstrap_study_sessions(p)
        for ss in StudySession.objects.filter(participant=p):
            ss.status = StudySession.Status.COMPLETED
            ss.save()
        sixth = StudySession.objects.get(participant=p, week_index=2, slot_index=3)
        sixth.status = StudySession.Status.AVAILABLE
        sixth.save()
        refresh_session_availability(p)

        convo = Conversation.objects.create(
            user_name="A",
            character="default",
            participant=p,
        )
        sixth.conversation = convo
        sixth.status = StudySession.Status.IN_PROGRESS
        sixth.started_at = timezone.now()
        sixth.last_activity_at = timezone.now()
        sixth.save()

        r = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": str(sixth.id),
                    "endReason": "completed_content",
                    "likert": {"rapport": 4, "closeness": 3, "flow": 5},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {p.auth_token}",
        )
        self.assertEqual(r.status_code, 400)

        r_ok = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": str(sixth.id),
                    "endReason": "completed_content",
                    "likert": {"rapport": 4, "closeness": 3, "flow": 5},
                    "comprehension": {"main_response": "Week 2 block answer."},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {p.auth_token}",
        )
        self.assertEqual(r_ok.status_code, 200)

    def test_control_requires_req_scores(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-C"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        token = json.loads(r.content)["authToken"]
        prog = json.loads(
            self.client.get(
                "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {token}"
            ).content
        )
        sid = prog["focusSessionId"]
        self.client.post(
            "/api/study/session/start/",
            data=json.dumps(
                {
                    "studySessionId": sid,
                    "userName": "C",
                    "character": "default",
                    "initialMessage": "Hi.",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        r_bad = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": sid,
                    "endReason": "completed_content",
                    "likert": {"rapport": 3, "closeness": 3, "flow": 3},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r_bad.status_code, 400)

        r_ok = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(
                {
                    "studySessionId": sid,
                    "endReason": "completed_content",
                    "likert": {"rapport": 3, "closeness": 3, "flow": 3},
                    "comprehension": {"main_response": "Smoke comprehension."},
                    "req_scores": REQ_SMOKE_BODY,
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r_ok.status_code, 200)
        ss = StudySession.objects.get(id=sid)
        self.assertEqual(ss.req_scores.get("connection"), 3)

    def test_wall_lock_rejects_save_message(self):
        p = Participant.objects.create(
            condition=Participant.Condition.GENERIC,
            auth_token=secrets.token_urlsafe(32),
            enrollment_code_used="TEST-G",
        )
        bootstrap_study_sessions(p)
        ss = StudySession.objects.get(participant=p, week_index=1, slot_index=1)
        convo = Conversation.objects.create(
            user_name="A",
            character="default",
            participant=p,
        )
        ss.conversation = convo
        ss.status = StudySession.Status.IN_PROGRESS
        ss.started_at = timezone.now() - timezone.timedelta(minutes=25)
        ss.last_activity_at = timezone.now()
        ss.save()

        r = self.client.post(
            "/api/save-message/",
            data=json.dumps(
                {
                    "conversationId": str(convo.id),
                    "sender": "user",
                    "content": "hi",
                    "meta": {},
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {p.auth_token}",
        )
        self.assertEqual(r.status_code, 403)
        body = json.loads(r.content)
        self.assertTrue(body.get("sessionLocked"))

    def test_login_success_and_token_rotation(self):
        reg = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-G", pin="9876"),
            content_type="application/json",
        )
        self.assertEqual(reg.status_code, 200)
        reg_data = json.loads(reg.content)
        old_token = reg_data["authToken"]
        lc = reg_data["loginCode"]

        log = self.client.post(
            "/api/study/login/",
            data=json.dumps({"loginCode": lc, "pin": "9876"}),
            content_type="application/json",
        )
        self.assertEqual(log.status_code, 200)
        log_data = json.loads(log.content)
        self.assertNotEqual(log_data["authToken"], old_token)

        prog = self.client.get(
            "/api/study/progress/",
            HTTP_AUTHORIZATION=f"Bearer {log_data['authToken']}",
        )
        self.assertEqual(prog.status_code, 200)

    def test_login_wrong_pin(self):
        reg = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-G"),
            content_type="application/json",
        )
        lc = json.loads(reg.content)["loginCode"]
        r = self.client.post(
            "/api/study/login/",
            data=json.dumps({"loginCode": lc, "pin": "9999"}),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 401)

    def test_login_unknown_code(self):
        r = self.client.post(
            "/api/study/login/",
            data=json.dumps({"loginCode": "ZZZZZZZZZZ", "pin": "1234"}),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 401)


@override_settings(
    STUDY_CODES_PERSONALIZED="TEST-P",
    STUDY_CODES_GENERIC="TEST-G",
    STUDY_CODES_CONTROL="TEST-C",
    STUDY_START_DATE="1990-01-01",
    STUDY_TIMEZONE="UTC",
    STUDY_TOTAL_WEEKS=3,
    STUDY_PROFILE_PERSONALIZED_MAX_SESSION_MINUTES=20,
    STUDY_PROFILE_GENERIC_MAX_SESSION_MINUTES=20,
    STUDY_PIN_MIN_LENGTH=4,
    STUDY_PIN_MAX_LENGTH=6,
    STUDY_LOGIN_CODE_LENGTH=10,
    STUDY_ROTATE_TOKEN_ON_LOGIN=True,
    STUDY_DAY_SPACING_ENFORCED=False,
)
class StudyThreeArmFullScheduleSmokeTests(TestCase):
    """
    Smoke: sequential start+complete for every session (3 weeks × 3 slots = 9)
    for personalized, generic, and control (enrollment code).
    """

    def setUp(self):
        self.client = Client()

    def _walk_full_schedule(self, token: str, *, control: bool) -> int:
        likert = {"rapport": 3, "closeness": 3, "flow": 3}
        steps = 0
        while True:
            r = self.client.get(
                "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {token}"
            )
            self.assertEqual(r.status_code, 200)
            prog = json.loads(r.content)
            sid = prog.get("focusSessionId")
            if not sid:
                self.assertEqual(
                    prog.get("message"), "All scheduled sessions completed."
                )
                break
            gidx = prog.get("focusGlobalSessionIndex")
            self.assertIsNotNone(gidx)
            st = prog.get("focusStatus")
            if st == "available":
                rs = self.client.post(
                    "/api/study/session/start/",
                    data=json.dumps(
                        {
                            "studySessionId": sid,
                            "userName": "Smoke",
                            "character": "default",
                            "initialMessage": "Hi.",
                        }
                    ),
                    content_type="application/json",
                    HTTP_AUTHORIZATION=f"Bearer {token}",
                )
                self.assertEqual(rs.status_code, 200, rs.content)
            elif st != "in_progress":
                self.fail(f"unexpected focus status {st!r} for session {sid}")

            body = {
                "studySessionId": sid,
                "endReason": "completed_content",
                "likert": likert,
            }
            if gidx in (1, 3, 6, 9):
                body["comprehension"] = {"main_response": "Smoke comprehension."}
            if control:
                body["req_scores"] = REQ_SMOKE_BODY

            rc = self.client.post(
                "/api/study/session/complete/",
                data=json.dumps(body),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )
            self.assertEqual(rc.status_code, 200, rc.content)
            steps += 1
            self.assertLess(steps, 24, "schedule walk exceeded expected length")
        return steps

    def test_smoke_personalized_all_sessions(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-P"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        token = json.loads(r.content)["authToken"]
        self.assertEqual(self._walk_full_schedule(token, control=False), 9)

    def test_smoke_generic_all_sessions(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-G"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        token = json.loads(r.content)["authToken"]
        self.assertEqual(self._walk_full_schedule(token, control=False), 9)

    def test_smoke_control_all_sessions(self):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload("TEST-C"),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        token = json.loads(r.content)["authToken"]
        self.assertEqual(self._walk_full_schedule(token, control=True), 9)


@override_settings(
    STUDY_CODES_PERSONALIZED="TEST-P",
    STUDY_CODES_GENERIC="TEST-G",
    STUDY_CODES_CONTROL="TEST-C",
    STUDY_START_DATE="1990-01-01",
    STUDY_TIMEZONE="UTC",
    STUDY_TOTAL_WEEKS=3,
    STUDY_PIN_MIN_LENGTH=4,
    STUDY_PIN_MAX_LENGTH=6,
    STUDY_LOGIN_CODE_LENGTH=10,
    STUDY_DAY_SPACING_ENFORCED=True,
)
class StudyDaySpacingTests(TestCase):
    """Sessions 2 and 3 must each fall on a different calendar day from the
    previous session. Sessions 4-9 unlock immediately after the previous one."""

    def setUp(self):
        self.client = Client()

    def _register(self, code="TEST-P"):
        r = self.client.post(
            "/api/study/register/",
            data=_register_payload(code),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        data = json.loads(r.content)
        return data["authToken"], Participant.objects.get(id=data["participantId"])

    def _complete(self, token, sid, gidx):
        body = {
            "studySessionId": sid,
            "endReason": "completed_content",
            "likert": {"rapport": 3, "closeness": 3, "flow": 3},
        }
        if gidx in (1, 3, 6, 9):
            body["comprehension"] = {"main_response": "ok"}
        r = self.client.post(
            "/api/study/session/complete/",
            data=json.dumps(body),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 200, r.content)

    def _start(self, token, sid):
        r = self.client.post(
            "/api/study/session/start/",
            data=json.dumps(
                {"studySessionId": sid, "userName": "Test", "character": "default"}
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        return r

    def _progress(self, token):
        r = self.client.get(
            "/api/study/progress/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(r.status_code, 200)
        return json.loads(r.content)

    def _backdate_completed(self, participant, days):
        """Pretend every COMPLETED session ended `days` days earlier in real time."""
        for ss in StudySession.objects.filter(
            participant=participant, status=StudySession.Status.COMPLETED
        ):
            ss.ended_at = ss.ended_at - timezone.timedelta(days=days)
            ss.save(update_fields=["ended_at"])

    def test_session_2_locked_same_day_unlocks_next_day(self):
        token, p = self._register()
        prog = self._progress(token)
        s1_id = prog["focusSessionId"]
        self.assertEqual(prog["focusGlobalSessionIndex"], 1)

        # Complete session 1 (today).
        self._start(token, s1_id)
        self._complete(token, s1_id, 1)

        # Session 2 should NOT be available yet (same calendar day as session 1).
        prog = self._progress(token)
        self.assertEqual(prog["focusGlobalSessionIndex"], 2)
        self.assertEqual(
            prog["focusStatus"],
            "locked",
            "session 2 should be locked on the same day as session 1",
        )

        # Backdate session 1 to "yesterday" → spacing now satisfied.
        self._backdate_completed(p, days=1)
        prog = self._progress(token)
        self.assertEqual(prog["focusStatus"], "available")

    def test_session_4_unlocks_immediately_after_session_3(self):
        token, p = self._register()
        # Walk sessions 1→3 with backdating between each so spacing passes.
        for expected_g in (1, 2, 3):
            prog = self._progress(token)
            self.assertEqual(prog["focusGlobalSessionIndex"], expected_g)
            sid = prog["focusSessionId"]
            self._start(token, sid)
            self._complete(token, sid, expected_g)
            self._backdate_completed(p, days=1)

        # Session 4 must be AVAILABLE the same day as session 3 (no spacing).
        prog = self._progress(token)
        self.assertEqual(prog["focusGlobalSessionIndex"], 4)
        self.assertEqual(
            prog["focusStatus"],
            "available",
            "session 4 must unlock immediately after session 3 — no spacing rule",
        )

    def test_sessions_5_to_9_chain_without_spacing(self):
        token, p = self._register()
        # Get past 1-3 with spacing.
        for expected_g in (1, 2, 3):
            prog = self._progress(token)
            sid = prog["focusSessionId"]
            self._start(token, sid)
            self._complete(token, sid, expected_g)
            self._backdate_completed(p, days=1)
        # Now sessions 4..9 chain back-to-back, all today.
        for expected_g in (4, 5, 6, 7, 8, 9):
            prog = self._progress(token)
            self.assertEqual(prog["focusGlobalSessionIndex"], expected_g)
            self.assertEqual(prog["focusStatus"], "available")
            sid = prog["focusSessionId"]
            self._start(token, sid)
            self._complete(token, sid, expected_g)


@override_settings(STUDY_PIN_MIN_LENGTH=4, STUDY_PIN_MAX_LENGTH=6)
class StudyValidationTests(TestCase):
    def test_pin_validation(self):
        self.assertIsNone(validate_pin_pair("1234", "1234"))
        self.assertIsNotNone(validate_pin_pair("1234", "1235"))
        self.assertIsNotNone(validate_pin_pair("12ab", "12ab"))

    def test_likert_validator(self):
        self.assertTrue(
            validate_likert({"rapport": 1, "closeness": 5, "flow": 3})
        )
        self.assertFalse(validate_likert({"rapport": 6, "closeness": 1, "flow": 1}))
        self.assertFalse(validate_likert({}))

    def test_comprehension_provided(self):
        self.assertTrue(comprehension_provided({"a": "text"}))
        self.assertFalse(comprehension_provided({"a": ""}))
        self.assertFalse(comprehension_provided({}))
