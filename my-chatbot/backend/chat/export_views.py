import csv
import json
from django.http import HttpResponse
from django.contrib.auth.decorators import user_passes_test
from .models import StudySession, Conversation
from .study_services import global_session_index

@user_passes_test(lambda u: u.is_staff)
def export_quantitative_data(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="study_data_complete.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Participant ID', 'Condition', 'Week', 'Slot', 'GlobalSession', 'Status',
        'CAIQ_Score', 'PANAS_Positive_Mean', 'PANAS_Negative_Mean', 'Overall_Affect',
        'RCQ_Score',
        'REQ_SocialPresence', 'REQ_Connection', 'REQ_Responsiveness',
        'REQ_Autonomy', 'REQ_Motivation', 'REQ_LatentDemand',
        'REQ_UnmetNeed', 'REQ_Isolation',
        # Activity sheet engagement signals — added to support longitudinal analysis.
        'ActivitySheet_TasksChecked',
        'ActivitySheet_TasksWithNotes',
        'ActivitySheet_TotalNoteChars',
    ])

    sessions = StudySession.objects.select_related("participant").all().order_by(
        "participant_id", "week_index", "slot_index"
    )

    for s in sessions:
        panas = s.caiq_panas_scores or {}
        req = s.req_scores or {}
        rcq = s.rcq_score.get('total_score') if s.rcq_score else None
        g_idx = global_session_index(s.week_index, s.slot_index)

        # Per-session activity-sheet roll-ups: how many tasks were ticked, how many
        # had a non-empty note, and total characters written across notes (proxy
        # for reflective engagement).
        sheet = s.activity_sheet_responses or {}
        checked = sheet.get('checkedTasks') or {}
        notes = sheet.get('taskNotes') or {}
        n_checked = sum(1 for v in checked.values() if v)
        n_with_notes = sum(
            1 for k, v in checked.items()
            if v and str(notes.get(k, '')).strip()
        )
        total_note_chars = sum(len(str(v).strip()) for v in notes.values())

        writer.writerow([
            s.participant.id,
            s.participant.condition,
            s.week_index,
            s.slot_index,
            g_idx,
            s.status,
            panas.get('caiq_score'),
            panas.get('panas_positive'),
            panas.get('panas_negative'),
            panas.get('overall_affect'),
            rcq,
            req.get('social_presence'),
            req.get('connection'),
            req.get('responsiveness'),
            req.get('autonomy'),
            req.get('motivation'),
            req.get('latent_demand'),
            req.get('unmet_need'),
            req.get('isolation'),
            n_checked,
            n_with_notes,
            total_note_chars,
        ])
    return response


@user_passes_test(lambda u: u.is_staff)
def export_activity_sheets(request):
    """
    Long-format CSV: one row per (participant, session, task) with the child's
    free-text answer. Companion to the wide quantitative export — gives access
    to the qualitative content of the activity sheet for thematic analysis.
    """
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="activity_sheets.csv"'

    writer = csv.writer(response)
    writer.writerow([
        "Participant ID",
        "Condition",
        "Week",
        "Slot",
        "GlobalSession",
        "Status",
        "SheetSession",
        "TaskID",
        "Checked",
        "Note",
        "NoteCharCount",
    ])

    sessions = StudySession.objects.select_related("participant").all().order_by(
        "participant_id", "week_index", "slot_index"
    )

    for s in sessions:
        sheet = s.activity_sheet_responses or {}
        checked = sheet.get("checkedTasks") or {}
        notes = sheet.get("taskNotes") or {}
        sheet_session = sheet.get("sheetSession")
        task_ids = set(checked.keys()) | set(notes.keys())
        if not task_ids:
            continue
        g_idx = global_session_index(s.week_index, s.slot_index)
        for tid in sorted(task_ids):
            note = str(notes.get(tid, "")).strip()
            writer.writerow([
                s.participant.id,
                s.participant.condition,
                s.week_index,
                s.slot_index,
                g_idx,
                s.status,
                sheet_session,
                tid,
                bool(checked.get(tid)),
                note,
                len(note),
            ])
    return response


@user_passes_test(lambda u: u.is_staff)
def export_chat_logs(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="chat_logs.csv"'

    writer = csv.writer(response)
    writer.writerow(
        [
            "Conversation ID",
            "Participant ID",
            "User Name",
            "Character",
            "Started At",
            "Messages JSON",
            "Audit JSON",
        ]
    )

    conversations = Conversation.objects.select_related("participant").all().order_by("started_at")
    for convo in conversations:
        writer.writerow(
            [
                convo.id,
                convo.participant_id or "",
                convo.user_name,
                convo.character,
                convo.started_at.isoformat() if convo.started_at else "",
                json.dumps(convo.messages or [], ensure_ascii=False),
                json.dumps(convo.audit or {}, ensure_ascii=False),
            ]
        )

    return response