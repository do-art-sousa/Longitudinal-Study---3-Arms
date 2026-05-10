#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Backup db.sqlite3 to a destination folder (default: macOS iCloud Drive).
#
# Usage from cron / launchd:
#   */30 * * * * /Users/duartesousa/Desktop/TEste/Longitudinal-Study-3-Arms-GitHub-Upload/my-chatbot/backend/scripts/backup_db.sh >> /tmp/study_backup.log 2>&1
#
# Override the destination by exporting STUDY_BACKUP_DEST before invocation,
# e.g. point at Google Drive Stream:
#   STUDY_BACKUP_DEST="/Users/duartesousa/Library/CloudStorage/GoogleDrive-…/study-backups"
#
# Strategy:
#   1. Use sqlite3's `.backup` for a consistent snapshot (safe even while
#      Django is writing). Falls back to `cp` only if sqlite3 is missing.
#   2. Keep the last STUDY_BACKUP_KEEP copies (default 96 = 2 days @ 30 min).
# -----------------------------------------------------------------------------

set -euo pipefail

DB="/Users/duartesousa/Desktop/TEste/Longitudinal-Study-3-Arms-GitHub-Upload/my-chatbot/backend/db.sqlite3"
DEST="${STUDY_BACKUP_DEST:-/Users/duartesousa/Library/Mobile Documents/com~apple~CloudDocs/study-backups}"
KEEP="${STUDY_BACKUP_KEEP:-96}"

mkdir -p "$DEST"

if [ ! -f "$DB" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S')  no DB at $DB — skipping"
  exit 0
fi

TS="$(date '+%Y-%m-%d_%H%M%S')"
NAME="db_${TS}.sqlite3"
TARGET="$DEST/$NAME"

if command -v sqlite3 >/dev/null 2>&1; then
  # `.backup` does an online consistent snapshot — safe even with the dev
  # server holding open connections to the file.
  sqlite3 "$DB" ".backup '$TARGET'"
else
  cp "$DB" "$TARGET"
fi

# Prune older copies, keeping the newest $KEEP.
ls -1t "$DEST"/db_*.sqlite3 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r OLD; do
  rm -f -- "$OLD"
done

# Sanity: refuse to silently produce an empty backup.
if [ ! -s "$TARGET" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S')  WARNING: backup file $TARGET is empty"
  exit 2
fi

echo "$(date '+%Y-%m-%d %H:%M:%S')  ok → $TARGET ($(wc -c <"$TARGET") bytes)"
