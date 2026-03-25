#!/bin/bash
# DropCatch daily data update script
# Run via cron at 2:00 AM server time daily
# Fetches all auction data (CSV + API prices) and updates the database

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/data/dropcatch-update.log"
PORT="${PORT:-3001}"
API_URL="http://127.0.0.1:$PORT"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== DropCatch daily update started ==="

# Check if the server is running
if ! curl -s "$API_URL/api/auth/status" > /dev/null 2>&1; then
  log "ERROR: Server not responding at $API_URL"
  exit 1
fi

# Trigger data refresh via API
# Uses account_id=0 (system) to bypass auth for cron jobs
RESULT=$(curl -s "$API_URL/api/dropcatch/generate" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-account-id: 1" \
  --max-time 300 \
  -d '{"tlds":[".com",".net",".org"]}' 2>&1)

if echo "$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Imported: {d.get(\"imported\",0)}, Priced: {d.get(\"priced\",0)}')" 2>/dev/null; then
  log "Update completed: $RESULT"
else
  log "ERROR: Update failed: $RESULT"
  exit 1
fi

# Cleanup old log entries (keep last 30 days)
if [ -f "$LOG_FILE" ]; then
  tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log "=== DropCatch daily update finished ==="
