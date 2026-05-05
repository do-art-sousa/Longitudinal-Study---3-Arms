from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0008_studysession_caiq_panas_scores"),
    ]

    operations = [
        migrations.AddField(
            model_name="studysession",
            name="req_scores",
            field=models.JSONField(
                blank=True,
                help_text="Metrics: Social Presence, Connection, Isolation, etc.",
                null=True,
            ),
        ),
    ]

