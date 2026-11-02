#!/usr/bin/env bash
# Restores a backup made on the Windows server (server.bat backup) into a project checkout on Linux.
#
#   deploy/linux/restore.sh lab3d-backup-2026-11-02_1830.tar.gz /opt/lab3d [--force]
#
# What it does:
#   1. Unpacks .env.production, uploads/, lab/.env and lab/data/ into the project folder
#      (the archive holds them at the same paths as in the project).
#   2. Loads database.sql into the site's PostgreSQL database. The database must exist and be
#      empty. Its address is $DATABASE_URL if set, otherwise DATABASE_URL from the restored
#      .env.production - on a new server that is usually wrong, so set it (and fix the file).
#
# Without --force it refuses to overwrite existing files or a non-empty database.
# Bambuddy is not in the archive: restore it from its own backup (Settings -> Backup).
set -euo pipefail

usage() { echo "usage: $0 <backup.tar.gz> <project-dir> [--force]" >&2; exit 2; }
[[ $# -ge 2 ]] || usage
archive=$1
project=$2
force=${3:-}
[[ -z $force || $force == --force ]] || usage

[[ -f $archive ]] || { echo "No such archive: $archive" >&2; exit 1; }
[[ -d $project ]] || { echo "No such project folder: $project (clone the repository first)" >&2; exit 1; }
command -v psql >/dev/null || { echo "psql not found: install PostgreSQL client (apt install postgresql-client)" >&2; exit 1; }

step() { printf '\n==> %s\n' "$*"; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

step "Reading the archive"
tar -xzf "$archive" -C "$work"
for required in manifest.json database.sql; do
  [[ -f $work/$required ]] || { echo "Not a Lab3D backup: $required is missing" >&2; exit 1; }
done
grep -E '"(createdAt|machine|gitCommit|domain)"' "$work/manifest.json" | sed 's/^ */    /' || true

# Checked before anything is copied, so a refusal leaves the project untouched.
step "Database check"
url=${DATABASE_URL:-}
if [[ -z $url ]]; then
  url=$({ tr -d '\r' < "$work/.env.production"; } 2>/dev/null | grep -E '^DATABASE_URL=' | head -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//') || true
  echo "    DATABASE_URL is not set - using the one from the backup's .env.production"
fi
[[ -n $url ]] || { echo "No DATABASE_URL" >&2; exit 1; }
# ?schema=... is Prisma's; psql rejects it.
url=${url%%\?*}
tables=$(psql "$url" -tAc "select count(*) from information_schema.tables where table_schema = 'public'")
if [[ $tables != 0 && $force != --force ]]; then
  echo "    The database already has $tables tables - restore into an empty database (or --force to load on top)" >&2
  exit 1
fi
echo "    reachable, tables: $tables"

step "Files"
for rel in .env.production uploads lab/.env lab/data; do
  src=$work/$rel
  dst=$project/$rel
  if [[ ! -e $src ]]; then echo "    $rel: not in the backup, skipped"; continue; fi
  if [[ -e $dst && $force != --force ]]; then
    # An empty uploads/ (just .gitkeep from the repository) doesn't count as existing data.
    if [[ -d $dst && -z $(find "$dst" -mindepth 1 ! -name .gitkeep -print -quit) ]]; then :; else
      echo "    $rel already exists in $project - rerun with --force to overwrite" >&2; exit 1
    fi
  fi
  mkdir -p "$(dirname "$dst")"
  rm -rf "$dst"
  cp -a "$src" "$dst"
  echo "    $rel"
done
# Keys and customer data: only the owner may read them.
chmod 600 "$project/.env.production" "$project/lab/.env" 2>/dev/null || true

step "Database"
psql "$url" -v ON_ERROR_STOP=1 -q -f "$work/database.sql" >/dev/null
echo "    loaded: $(psql "$url" -tAc 'select count(*) from "Order"') orders, $(psql "$url" -tAc 'select count(*) from "UploadedFile"') uploaded files"

cat <<EOF

Done. Next:
  1. Check $project/.env.production: DATABASE_URL, APP_URL, LAB_API_URL, BAMBUDDY_URL for the new server.
  2. In $project: npm ci && npx prisma generate && npm run build
  3. Bambuddy: install it and restore its own backup (Settings -> Backup).
EOF
