#!/bin/bash
set -e
cd /root/GeekSpace2.0
WEBHOOK_SECRET=$(grep TELEGRAM_WEBHOOK_SECRET .env | cut -d= -f2)
BASE_URL="http://localhost:3001/api/webhooks/telegram"
CHAT_ID=5337185054
MSG_ID=1000
PASS=0
FAIL=0

send_msg() {
  local text="$1"
  local label="$2"
  MSG_ID=$((MSG_ID + 1))
  echo ""
  echo "--- Test: $label ---"
  echo "Sending: $text"
  HTTP_CODE=$(curl -s -o /tmp/tg-response.txt -w "%{http_code}" -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: $WEBHOOK_SECRET" \
    -d "{
      \"update_id\": $((RANDOM + 100000)),
      \"message\": {
        \"message_id\": $MSG_ID,
        \"from\": {\"id\": $CHAT_ID, \"is_bot\": false, \"first_name\": \"Aliya\"},
        \"chat\": {\"id\": $CHAT_ID, \"type\": \"private\"},
        \"date\": $(date +%s),
        \"text\": \"$text\"
      }
    }")
  BODY=$(cat /tmp/tg-response.txt)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  -> HTTP $HTTP_CODE  PASS"
    PASS=$((PASS + 1))
  else
    echo "  -> HTTP $HTTP_CODE  FAIL  Body: $BODY"
    FAIL=$((FAIL + 1))
  fi
  sleep 4
}

echo "============================================"
echo " AGENTIN TELEGRAM LIVE TEST — $(date)"
echo "============================================"
echo "Webhook: $BASE_URL"
echo "Chat ID: $CHAT_ID"
echo "Secret:  ${WEBHOOK_SECRET:0:6}..."
echo "============================================"

# 1. Greeting
send_msg "Hey!" "1/17 Greeting"

# 2. English reminder
send_msg "remind me to call the dentist tomorrow at 3pm" "2/17 English reminder"

# 3. Hinglish reminder
send_msg "kal subah 8 baje mujhe gym jaana hai yaad dilana" "3/17 Hinglish reminder"

# 4. Expense tracking
send_msg "spent 450 at Swiggy" "4/17 Expense tracking"

# 5. Hinglish expense
send_msg "Zomato pe 280 rupay kharch kiya" "5/17 Hinglish expense"

# 6. Habit tracking
send_msg "I did my morning workout today" "6/17 Habit tracking"

# 7. Note/doc capture
send_msg "note: Meeting with Raj about API pricing - they want 5 paisa per call" "7/17 Note capture"

# 8. Memory save (BLOCKER-006 test)
send_msg "remember that I prefer dark mode and TypeScript" "8/17 Memory save"

# 9. Memory recall
send_msg "what do you know about my preferences?" "9/17 Memory recall"

# 10. Search
send_msg "search for latest React 19 features" "10/17 Web search"

# 11. Help command
send_msg "/help" "11/17 Help command"

# 12. Status check
send_msg "/status" "12/17 Status command"

# 13. Focus session
send_msg "start a 25 minute focus session for coding" "13/17 Focus session"

# 14. List reminders
send_msg "show my reminders" "14/17 List reminders"

# 15. Another Hinglish expense pattern
send_msg "aaj petrol bhara 2500 ka" "15/17 Hinglish petrol expense"

# 16. Creative question (tests persona)
send_msg "tell me a joke about programmers" "16/17 Persona/creative"

# 17. Brief request
send_msg "/brief" "17/17 Morning brief"

echo ""
echo "============================================"
echo " RESULTS: $PASS passed, $FAIL failed (out of 17)"
echo "============================================"
if [ "$FAIL" -eq 0 ]; then
  echo " ALL 17 TEST MESSAGES SENT SUCCESSFULLY"
else
  echo " $FAIL message(s) had non-200 responses"
fi
echo " Check Aliya's Telegram for responses!"
echo "============================================"
