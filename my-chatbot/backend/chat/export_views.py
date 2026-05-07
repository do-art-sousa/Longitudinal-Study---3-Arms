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
    ])
    
    sessions = StudySession.objects.select_related("participant").all().order_by(
        "participant_id", "week_index", "slot_index"
    )
    
    for s in sessions:
        panas = s.caiq_panas_scores or {}
        req = s.req_scores or {}
        rcq = s.rcq_score.get('total_score') if s.rcq_score else None
        g_idx = global_session_index(s.week_index, s.slot_index)

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