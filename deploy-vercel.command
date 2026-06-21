#!/bin/zsh
cd "$(dirname "$0")" || exit 1

TOKEN_FILE="$(dirname "$0")/.vercel-token"
APP_URL="https://mowbound-iota.vercel.app"

pause_if_finder() {
  [[ ${SHLVL:-1} -le 1 ]] && read "?Press Enter to close..."
}

echo "=============================="
echo "  Mowbound — Vercel Deploy"
echo "=============================="
echo

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Error: .vercel-token 파일이 없습니다."
  echo "vercel.com/account/tokens 에서 토큰을 만들고"
  echo ".vercel-token 파일에 저장해 주세요."
  pause_if_finder
  exit 1
fi

VERCEL_TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

echo "Building & Deploying..."
RESULT=$(vercel --token "$VERCEL_TOKEN" --yes --scope pikoloveme-ctrls-projects --prod 2>&1)
echo "$RESULT"

if echo "$RESULT" | grep -q "READY\|ready"; then
  echo
  echo "=============================="
  echo "  Deploy complete!"
  echo "=============================="
  echo
  echo "  URL: $APP_URL"
  echo
  echo -n "$APP_URL" | pbcopy
  echo "  (URL이 클립보드에 복사됐어요)"
  echo "=============================="
  echo
else
  echo
  echo "Deploy may have failed. Check output above."
fi

pause_if_finder
