import csv
import json
from django.http import HttpResponse
from django.contrib.auth.decorators import user_passes_test
from .models import StudySession, Conversation

@user_passes_test(lambda u: u.is_staff)
def export_quantitative_data(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="study_data_complete.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Participant ID', 'Condition', 'Session', 'Status',
        'PA_Mean', 'NA_Mean', 'Overall_Affect', 'RCQ_Score',
        'REQ_SocialPresence', 'REQ_Connection', 'REQ_Responsiveness',
        'REQ_Autonomy', 'REQ_Motivation', 'REQ_LatentDemand',
        'REQ_UnmetNeed', 'REQ_Isolation'
    ])
    
    sessions = StudySession.objects.select_related("participant").all().order_by(
        "participant_id", "week_index", "slot_index"
    )
    
    for s in sessions:
        panas = s.caiq_panas_scores or {}
        req = s.req_scores or {}
        rcq = s.rcq_score.get('total_score') if s.rcq_score else None
        
        writer.writerow([
            s.participant.id,
            s.participant.condition,
            s.slot_index,
            s.status,
            panas.get('pa_mean'),
            panas.get('na_mean'),
            panas.get('overall_affect'),
            rcq,
            req.get('social_presence'), # REQ-01
            req.get('connection'),      # REQ-02
            req.get('responsiveness'),  # REQ-03
            req.get('autonomy'),        # REQ-04
            req.get('motivation'),      # REQ-05
            req.get('latent_demand'),   # REQ-06
            req.get('unmet_need'),      # REQ-07
            req.get('isolation')        # REQ-08
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