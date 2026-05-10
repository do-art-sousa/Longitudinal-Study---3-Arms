"""Add per-task checkbox + notes capture to StudySession.

Activity sheet answers used to live only in the browser's localStorage
(see src/utils/activitySheetDraft.js) and were cleared on survey submit,
so the server never saw them. This migration makes the data persistable
so the longitudinal data set includes activity-sheet engagement.

Hand-written rather than generated to keep this change isolated from any
unrelated drift the auto-generated migration set would also pick up.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0009_studysession_req_scores"),
    ]

    operations = [
        migrations.AddField(
            model_name="studysession",
            name="activity_sheet_responses",
            field=models.JSONField(
                blank=True,
                null=True,
                help_text="Activity sheet — checkboxes and free-text answers per task.",
            ),
        ),
    ]
