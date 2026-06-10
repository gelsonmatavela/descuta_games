#!/usr/bin/env bash
# Faz login como admin do seed e testa o endpoint /api/admin/overview.
# Uso: bash scripts/admin.sh
set -euo pipefail

BASE="${BASE:-http://localhost:8080}"
EMAIL="${EMAIL:-admin@rage.dev}"
PASSWORD="${PASSWORD:-admin123}"

echo "==> Login em $BASE como $EMAIL"
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "!! Login falhou. Resposta do servidor:"
  echo "$LOGIN" | jq .
  exit 1
fi

echo "==> Token obtido (primeiros 30 chars): ${TOKEN:0:30}..."
echo
echo "==> GET /api/admin/overview"
curl -s "$BASE/api/admin/overview" -H "Authorization: Bearer $TOKEN" | jq .

echo
echo "Token completo exportado abaixo. Para reusar nesta sessao do shell:"
echo "  export TOKEN='$TOKEN'"
