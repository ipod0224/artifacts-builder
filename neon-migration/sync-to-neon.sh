#!/bin/bash
# sync-to-neon.sh — 將本機 tmw-postgres 同步到 Neon
#
# 用法：
#   ./neon-migration/sync-to-neon.sh              # 完整同步（schema + data）
#   ./neon-migration/sync-to-neon.sh --data-only   # 只同步資料（schema 已建好）
#   ./neon-migration/sync-to-neon.sh --table materials  # 只同步特定表
#
# 需要：NEON_DATABASE_URL 環境變數（或 .env.local 中設定）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DUMP_DIR="$SCRIPT_DIR"

# 載入環境變數
if [ -f "$HOME/.env.local" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.env.local"
fi

NEON_URL="${NEON_DATABASE_URL:-}"
if [ -z "$NEON_URL" ]; then
  echo "❌ 請設定 NEON_DATABASE_URL 環境變數"
  echo "   格式：postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
  exit 1
fi

LOCAL_DOCKER="docker exec tmw-postgres"
DATA_ONLY=false
TABLE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --data-only) DATA_ONLY=true; shift ;;
    --table) TABLE="$2"; shift 2 ;;
    *) echo "未知參數: $1"; exit 1 ;;
  esac
done

echo "🔄 開始同步到 Neon..."
echo "   來源：tmw-postgres (localhost:4202)"
echo "   目標：Neon"

# Step 1: Schema（僅首次或 --data-only 未設定時）
if [ "$DATA_ONLY" = false ]; then
  echo ""
  echo "📋 Step 1: 建立 schema..."
  psql "$NEON_URL" -f "$DUMP_DIR/neon-schema.sql" 2>&1 | grep -v "^$" || true
  echo "   ✅ Schema 完成"
fi

# Step 2: 匯出資料
echo ""
echo "📦 Step 2: 從本機匯出資料..."

TABLES=("materials" "documents" "qa_rules")
if [ -n "$TABLE" ]; then
  TABLES=("$TABLE")
fi

for tbl in "${TABLES[@]}"; do
  echo "   匯出 $tbl..."
  $LOCAL_DOCKER pg_dump -U tmw -d tmw \
    --data-only --no-owner --no-privileges \
    --table="$tbl" \
    --disable-triggers \
    > "$DUMP_DIR/${tbl}_data.sql"

  SIZE=$(wc -c < "$DUMP_DIR/${tbl}_data.sql")
  echo "   ✅ $tbl → $(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE}B")"
done

# Step 3: 匯入到 Neon
echo ""
echo "📤 Step 3: 匯入到 Neon..."

for tbl in "${TABLES[@]}"; do
  echo "   匯入 $tbl..."

  # 先清空目標表
  psql "$NEON_URL" -c "TRUNCATE $tbl CASCADE;" 2>/dev/null || true

  # 匯入資料
  psql "$NEON_URL" -f "$DUMP_DIR/${tbl}_data.sql" 2>&1 | tail -1
  echo "   ✅ $tbl 匯入完成"
done

# Step 4: 驗證
echo ""
echo "🔍 Step 4: 驗證..."

for tbl in "${TABLES[@]}"; do
  LOCAL_COUNT=$($LOCAL_DOCKER psql -U tmw -d tmw -t -c "SELECT COUNT(*) FROM $tbl;" | tr -d ' ')
  NEON_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM $tbl;" | tr -d ' ')
  STATUS="✅"
  if [ "$LOCAL_COUNT" != "$NEON_COUNT" ]; then
    STATUS="⚠️"
  fi
  echo "   $STATUS $tbl: 本機=$LOCAL_COUNT, Neon=$NEON_COUNT"
done

echo ""
echo "🎉 同步完成！"
echo ""
echo "📝 下一步："
echo "   1. 在 Vercel 設定 DATABASE_URL = $NEON_URL"
echo "   2. 重新部署 Vercel（git push 或 vercel --prod）"
