from django.contrib import admin

from .models import Conversation, Participant, StudySession


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user_name", "character", "participant", "started_at", "messages_preview")
    ordering = ("-started_at",)
    raw_id_fields = ("participant",)

    def messages_preview(self, obj):
        if not obj.messages:
            return "(no messages)"
        first = obj.messages[0]
        sender = first.get("sender", "?")
        content = first.get("content", "")[:40]
        return f"{sender}: {content}..."

    messages_preview.short_description = "First message"


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "login_code",
        "condition",
        "display_name",
        "enrollment_code_used",
        "created_at",
    )
    ordering = ("-created_at",)
    readonly_fields = ("id", "auth_token", "pin_hash", "created_at")
    search_fields = ("display_name", "enrollment_code_used", "login_code", "id")


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "participant",
        "week_index",
        "slot_index",
        "status",
        "rcq_score_summary",
        "caiq_scores_summary",
        "activity_sheet_summary",
        "started_at",
        "ended_at",
        "end_reason",
    )

    def rcq_score_summary(self, obj):
        if obj.rcq_score and "total_score" in obj.rcq_score:
            return f"{obj.rcq_score['total_score']} / {obj.rcq_score['max_possible']}"
        return "-"
    rcq_score_summary.short_description = "RCQ Score"

    def caiq_version(self, obj):
        if obj.caiq_panas_responses and "version" in obj.caiq_panas_responses:
            return obj.caiq_panas_responses["version"].upper()
        return "-"
    caiq_version.short_description = "CAIQ Version"

    def caiq_scores_summary(self, obj):
        if obj.caiq_panas_scores:
            scores = obj.caiq_panas_scores
            caiq = scores.get('caiq_score')
            pa = scores.get('panas_positive')
            na = scores.get('panas_negative')
            if caiq is not None:
                return f"CAIQ: {caiq:.2f} | PA: {pa:.2f} | NA: {na:.2f}"
        return "-"
    caiq_scores_summary.short_description = "Survey Scores"

    def activity_sheet_summary(self, obj):
        """Quick at-a-glance count: ticked tasks / tasks with non-empty notes."""
        sheet = obj.activity_sheet_responses or {}
        checked = sheet.get("checkedTasks") or {}
        notes = sheet.get("taskNotes") or {}
        n_checked = sum(1 for v in checked.values() if v)
        n_with_text = sum(
            1 for k, v in checked.items()
            if v and str(notes.get(k, "")).strip()
        )
        if n_checked == 0 and n_with_text == 0:
            return "-"
        return f"{n_checked} ✓ · {n_with_text} ✍️"
    activity_sheet_summary.short_description = "Activity Sheet"

    readonly_fields = (
        "id",
        "caiq_panas_responses",
        "rcq_score",
        "comprehension_responses",
        "caiq_panas_scores",
        "activity_sheet_responses",
    )
    list_filter = ("status", "week_index")
    ordering = ("participant", "week_index", "slot_index")
    raw_id_fields = ("participant", "conversation")
