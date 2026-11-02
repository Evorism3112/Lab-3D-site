#!/usr/bin/env bash
# Установка Лаборатории 3Д на Ubuntu / Debian - всё на одной машине, как было на Windows:
# сайт, «Заказы» (CRM), PostgreSQL, HTTPS (Caddy), Bambuddy, OrcaSlicer для цен, веб-панель.
#
#   git clone <репозиторий> /opt/lab3d && cd /opt/lab3d
#   sudo deploy/linux/install.sh --restore /path/lab3d-backup-….tar.gz     # переезд с Windows
#   sudo deploy/linux/install.sh --domain lab-3d.pro --email admin@…      # с нуля
#
# Параметры:
#   --domain D      домен сайта (при переезде берётся из бэкапа)
#   --email E       логин админа сайта при установке с нуля (по умолчанию admin)
#   --restore FILE  архив из «server.bat backup» / «lab3d backup» - только на чистую установку
#   --no-bambuddy   не ставить Bambuddy
#   --no-slicer     не ставить OrcaSlicer
#
# Повторный запуск безопасен: доставит недостающее и обновит настройки, данные не трогает.
set -euo pipefail

SELF=$(readlink -f "${BASH_SOURCE[0]}")
# shellcheck source=deploy/linux/lab3d
source "$(dirname "$SELF")/lab3d"

DOMAIN_ARG="" EMAIL="admin" RESTORE="" WITH_BAMBUDDY=1 WITH_SLICER=1
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN_ARG=$2; shift 2 ;;
    --email) EMAIL=$2; shift 2 ;;
    --restore) RESTORE=$(readlink -f "$2"); shift 2 ;;
    --no-bambuddy) WITH_BAMBUDDY=0; shift ;;
    --no-slicer) WITH_SLICER=0; shift ;;
    -h|--help) sed -n '2,17p' "$SELF" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Неизвестный параметр: $1 (--help)" ;;
  esac
done
[[ $EUID -eq 0 ]] || exec sudo "$SELF" "$@"

# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == ubuntu || ${ID:-} == debian || ${ID_LIKE:-} == *debian* ]] || die "Нужна Ubuntu или Debian (сейчас: ${PRETTY_NAME:-?})."
[[ -f $ROOT/package.json && -d $LAB ]] || die "Запускайте из папки проекта (нет $ROOT/package.json)."
FRESH=1; [[ -f $ENV_FILE ]] && FRESH=0
if [[ -n $RESTORE ]]; then
  [[ -f $RESTORE ]] || die "Нет архива: $RESTORE"
  (( FRESH )) || die "Восстановление - только на чистую установку: $ENV_FILE уже есть."
fi
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- пакеты

step "Системные пакеты"
apt-get update -q
apt-get install -y -q curl ca-certificates gnupg git openssl tar gzip sudo logrotate postgresql postgresql-client caddy >/dev/null
ok "git, PostgreSQL, Caddy"

node_major() { command -v node >/dev/null && node -p 'process.versions.node.split(".")[0]' || echo 0; }
if (( $(node_major) < 22 )); then
  step "Node.js 24 (NodeSource)"
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q && apt-get install -y -q nodejs >/dev/null
fi
ok "Node.js $(node -v)"

if (( WITH_SLICER )); then
  step "Библиотеки для OrcaSlicer"
  # Тот же набор, что в официальном Docker-образе orca-slicer-api; на Ubuntu 24.04+ часть
  # пакетов называется с суффиксом t64 - пробуем оба имени.
  for pkg in libgl1 libgl1-mesa-dri libegl1 libopengl0 libglu1-mesa libsm6 libice6 libmspack0 libgtk-3-0 \
    libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 libwebkit2gtk-4.1-0; do
    apt-get install -y -q "$pkg" >/dev/null 2>&1 || apt-get install -y -q "${pkg}t64" >/dev/null 2>&1 || warn "не установился $pkg"
  done
  ok "готово"
fi

# ---------------------------------------------------------------- пользователь и папка

step "Пользователь $APP_USER"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_HOME"
chown -R "$APP_USER:$APP_USER" "$ROOT"
runuser -u "$APP_USER" -- test -r "$ROOT/package.json" ||
  die "Пользователь $APP_USER не видит $ROOT (папка внутри закрытой домашней?). Склонируйте проект в /opt/lab3d."
ok "$ROOT принадлежит $APP_USER"

# ---------------------------------------------------------------- база

step "PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1
DB_PASSWORD=$(openssl rand -hex 24)
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN
    ALTER ROLE $APP_USER WITH LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    CREATE ROLE $APP_USER WITH LOGIN PASSWORD '$DB_PASSWORD';
  END IF;
END \$\$;
SQL
[[ $(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$APP_USER'") == 1 ]] ||
  runuser -u postgres -- createdb -O "$APP_USER" "$APP_USER"
DATABASE_URL="postgresql://$APP_USER:$DB_PASSWORD@127.0.0.1:5432/$APP_USER"
ok "база $APP_USER, пользователь $APP_USER"

# ---------------------------------------------------------------- перенос данных

if [[ -n $RESTORE ]]; then
  step "Восстановление из $RESTORE"
  # Архив читает пользователь сайта; кладём его в закрытую папку бэкапов.
  install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$ROOT/backups"
  install -m 600 -o "$APP_USER" -g "$APP_USER" "$RESTORE" "$ROOT/backups/$(basename "$RESTORE")"
  as_user_in "$ROOT" env DATABASE_URL="$DATABASE_URL" bash "$ROOT/deploy/linux/restore.sh" "$ROOT/backups/$(basename "$RESTORE")" "$ROOT"
fi

# ---------------------------------------------------------------- настройки

step "Настройки (.env.production, lab/.env)"
DOMAIN=${DOMAIN_ARG:-$(env_get "$ENV_FILE" DEPLOY_DOMAIN)}
if [[ -z $DOMAIN && -t 0 ]]; then read -rp "    Домен сайта (пусто - без домена, по IP): " DOMAIN; fi
DOMAIN=${DOMAIN#https://}; DOMAIN=${DOMAIN%/}
apply_env "$DOMAIN" "$DATABASE_URL"
IP=$(hostname -I | awk '{print $1}')

# ---------------------------------------------------------------- сборка

build_all || die "Сборка не удалась - исправьте ошибку выше и запустите установку ещё раз."

step "Администратор сайта"
SITE_ADMIN_PASSWORD=""
has_admin=$(as_app node -e '
  const { Client } = require("pg"); const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.query(`select count(*)::int as n from "User" where role = $$ADMIN$$`))
    .then((r) => { console.log(r.rows[0].n); return c.end(); }).catch(() => console.log(0));')
[[ $has_admin != 0 ]] || SITE_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=\n')
as_app env NODE_ENV=production ADMIN_EMAIL="$EMAIL" ${SITE_ADMIN_PASSWORD:+ADMIN_PASSWORD="$SITE_ADMIN_PASSWORD"} npx tsx prisma/seed.ts | sed 's/^/    /'

step "Администратор «Заказов»"
CRM_ADMIN_PASSWORD=""
[[ -f $LAB/data/orders.db ]] || CRM_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=\n')
as_user_in "$LAB" env NODE_ENV=production ADMIN_USERNAME=admin ${CRM_ADMIN_PASSWORD:+ADMIN_PASSWORD="$CRM_ADMIN_PASSWORD"} node deploy/create-admin.mjs | sed 's/^/    /'

# ---------------------------------------------------------------- слайсер и Bambuddy

if (( WITH_SLICER )); then
  if slicer_current; then step "Слайсер"; ok "уже установлен ($(slicer_tag))"
  else step "Слайсер (OrcaSlicer для цен)"; as_user_in "$ROOT" bash "$ROOT/deploy/linux/install-slicer.sh" || warn "Слайсер не установлен - повторить: sudo lab3d slicer"; fi
fi

if (( WITH_BAMBUDDY )); then
  step "Bambuddy (принтеры)"
  if unit_exists bambuddy; then ok "уже установлен"
  else
    tmp=$(mktemp -d)
    if curl -fsSL -o "$tmp/install.sh" https://raw.githubusercontent.com/maziggy/bambuddy/main/install/install.sh &&
      bash "$tmp/install.sh" --path /opt/bambuddy --port "$(bambuddy_port)" --yes; then ok "http://$IP:$(bambuddy_port)"
    else warn "Bambuddy не установился - см. https://github.com/maziggy/bambuddy (install/install.sh)"; fi
    rm -rf "$tmp"
  fi
fi

# ---------------------------------------------------------------- службы и HTTPS

step "Команда lab3d"
sed "s#@LAB3D_ROOT@#$ROOT#" "$ROOT/deploy/linux/lab3d" > "$INSTALLED_CLI.tmp"
install -m 755 -o root -g root "$INSTALLED_CLI.tmp" "$INSTALLED_CLI"; rm -f "$INSTALLED_CLI.tmp"
ok "$INSTALLED_CLI"

cmd_config

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  step "Брандмауэр (ufw)"
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ok "открыты 80 и 443"
fi

step "Запуск"
systemctl restart lab3d-site lab3d-crm
slicer_installed && systemctl restart lab3d-slicer
panel_enabled && systemctl restart lab3d-panel
for _ in $(seq 1 60); do curl -fsS -o /dev/null "http://127.0.0.1:$(app_port)/" 2>/dev/null && break; sleep 1; done
curl -fsS -o /dev/null "http://127.0.0.1:$(app_port)/" 2>/dev/null && ok "сайт отвечает" || warn "сайт пока не ответил - lab3d logs site-errors"

# ---------------------------------------------------------------- итог

cmd_status
echo "  Установка завершена."
[[ -n $SITE_ADMIN_PASSWORD ]] && echo "  Админка сайта:   $EMAIL / $SITE_ADMIN_PASSWORD   <- показан один раз, сохраните"
[[ -n $CRM_ADMIN_PASSWORD ]] && echo "  «Заказы»:        admin / $CRM_ADMIN_PASSWORD   <- показан один раз, сохраните"
cat <<EOF

  Осталось:
    1. Роутер: проброс портов 80 и 443 на этот компьютер ($IP).
       DNS (A-записи) ${DOMAIN:-<домен>}, crm., bambu., panel. -> внешний IP - если IP не менялся, они уже верны.
    2. Bambuddy: http://$IP:$(bambuddy_port) -> Настройки -> Резервное копирование -> восстановить копию с Windows.
       Если ключ API создаётся заново - впишите его в $ENV_FILE (BAMBUDDY_API_KEY) и: sudo lab3d restart site
    3. Bambuddy -> Настройки -> Рабочий процесс -> «Слайсер»: OrcaSlicer, адрес http://127.0.0.1:$(slicer_port)
    4. Проверка нарезки: sudo lab3d slicer-test
    5. Управление дальше: lab3d (статус), sudo lab3d update / backup / logs, lab3d help
EOF
