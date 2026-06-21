#!/bin/zsh
cd "$(dirname "$0")" || exit 1

VIVERSE_BIN="/opt/homebrew/lib/node_modules/@viverse/cli/bin/cli.js"
APP_ID="rpb875u9pr"
APP_URL="https://worlds.viverse.com/WuoBzDs"

viverse() { node "$VIVERSE_BIN" "$@"; }

# Only pause when opened from Finder (fresh terminal, SHLVL=1)
pause_if_finder() {
  [[ ${SHLVL:-1} -le 1 ]] && read "?Press Enter to close..."
}

echo "=============================="
echo "  Mowbound — VIVERSE Deploy"
echo "=============================="
echo

# Check login status
AUTH_STATUS=$(viverse auth status 2>&1)
if echo "$AUTH_STATUS" | grep -q "Email:"; then
  LOGGED_IN_EMAIL=$(echo "$AUTH_STATUS" | grep "Email:" | awk '{print $2}')
  echo "✔ Logged in as $LOGGED_IN_EMAIL"
else
  echo "Not logged in. Logging in..."
  viverse auth login -e pikoloveme@gmail.com -p 'sjaksdmf!1'
  if [ $? -ne 0 ]; then
    echo
    echo "Login failed."
    pause_if_finder
    exit 1
  fi
fi

echo
echo "Building..."
npm run build
if [ $? -ne 0 ]; then
  echo
  echo "Build failed."
  pause_if_finder
  exit 1
fi

echo
echo "Deploying to VIVERSE..."
RESULT=$(viverse app publish ./dist --app-id "$APP_ID" 2>&1)
echo "$RESULT"

if echo "$RESULT" | grep -q "uploaded successfully"; then
  echo
  echo "=============================="
  echo "  Deploy complete!"
  echo "=============================="
  echo
  echo "  공유 링크:  ${APP_URL}?preview"
  echo "  (정식 공개 후): $APP_URL"
  echo
  echo "=============================="
  echo -n "${APP_URL}?preview" | pbcopy
  echo "  (공유 링크가 클립보드에 복사됐어요)"
  echo
else
  echo
  echo "Deploy may have failed. Check output above."
fi

pause_if_finder
