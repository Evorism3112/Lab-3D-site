#!/usr/bin/env bash
# Все данные сайта и «Заказов» в один архив - Linux-версия deploy/backup.ps1, тот же формат:
#   database.sql  .env.production  uploads/  lab/.env  lab/data/  manifest.json
# (пути как в проекте, восстановление - deploy/linux/restore.sh). Bambuddy - своим бэкапом.
#
# Запускается через «lab3d backup» от пользователя сайта, с переменными .env.production;
# сайт и «Заказы» на это время остановлены. Аргумент - папка для архива.
set -euo pipefail

ROOT=$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)
OUT=${1:-$ROOT/backups}
[[ -n ${DATABASE_URL:-} ]] || { echo "DATABASE_URL не задан (запускайте через lab3d backup)" >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "pg_dump не найден: apt install postgresql-client" >&2; exit 1; }

mkdir -p "$OUT"
stamp=$(date +%Y-%m-%d_%H%M)
archive=$OUT/lab3d-backup-$stamp.tar.gz
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT

echo "==> База сайта (pg_dump)"
# Без владельцев и прав: на другом сервере пользователь базы может называться иначе.
pg_dump "--dbname=${DATABASE_URL%%\?*}" --format=plain --no-owner --no-privileges --encoding=UTF8 --file="$staging/database.sql"
echo "    $(du -h "$staging/database.sql" | cut -f1) ($(pg_dump --version))"

items=()
for rel in .env.production uploads lab/.env lab/data; do
  if [[ -e $ROOT/$rel ]]; then items+=("$rel"); echo "    $(printf '%-16s' "$rel") $(du -sh "$ROOT/$rel" | cut -f1)"
  else echo "    ! нет $rel - пропускаю"; fi
done

json_list() { local first=1 x; printf '['; for x in "$@"; do (( first )) || printf ', '; printf '"%s"' "$x"; first=0; done; printf ']'; }
cat > "$staging/manifest.json" <<EOF
{
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "machine": "$(hostname)",
  "gitCommit": "$(git -c safe.directory='*' -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)",
  "pgDump": "$(pg_dump --version)",
  "domain": "${DEPLOY_DOMAIN:-}",
  "contents": $(json_list database.sql "${items[@]}"),
  "notes": "Bambuddy is not included: use its own backup (Settings -> Backup)."
}
EOF

echo "==> Архив"
tar -czf "$archive" -C "$staging" manifest.json database.sql -C "$ROOT" "${items[@]}"
# Читаем целиком: битая копия должна найтись сейчас, а не при переезде.
count=$(tar -tzf "$archive" | wc -l) || { rm -f "$archive"; echo "Архив не читается" >&2; exit 1; }
chmod 600 "$archive"
echo "    $archive ($(du -h "$archive" | cut -f1), файлов: $count)"
echo
echo "  Готово. Не забудьте копию Bambuddy (Настройки -> Резервное копирование)."
echo "  В архиве пароли и данные клиентов - храните его бережно."
