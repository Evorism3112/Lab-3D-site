#!/usr/bin/env bash
# Ставит (или переставляет) слайсер для цен на Linux: OrcaSlicer (AppImage, распакованный - без
# FUSE и графики) и HTTP-обёртку maziggy/orca-slicer-api, через которую его вызывает Bambuddy.
# То же, что deploy/install-slicer.ps1 на Windows; версии закреплены там же, в deploy/lib.ps1.
#
# Запускается от пользователя сайта через «lab3d slicer» (служба слайсера на это время остановлена).
# Системные библиотеки для OrcaSlicer ставит deploy/linux/install.sh.
set -euo pipefail

ROOT=$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)
SLICER_DIR=$ROOT/deploy/slicer
pinned() { sed -n "s/^\$script:$1 = \"\([^\"]*\)\".*/\1/p" "$ROOT/deploy/lib.ps1" | head -n1; }
VERSION=$(pinned SlicerOrcaVersion)
API_COMMIT=$(pinned SlicerApiCommit)
[[ -n $VERSION && -n $API_COMMIT ]] || { echo "Версии слайсера не найдены в deploy/lib.ps1" >&2; exit 1; }

step() { printf '==> %s\n' "$*"; }
ok() { printf '    %s\n' "$*"; }
warn() { printf '    ! %s\n' "$*"; }

case $(uname -m) in
  x86_64) APPIMAGE="OrcaSlicer_Linux_AppImage_Ubuntu2404_V${VERSION}.AppImage" ;;
  aarch64) APPIMAGE="OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V${VERSION}.AppImage" ;;
  *) echo "Неподдерживаемая архитектура: $(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$SLICER_DIR"
work=$(mktemp -d "$SLICER_DIR/.download-XXXXXX")
trap 'rm -rf "$work"' EXIT

step "OrcaSlicer $VERSION (~130 МБ)"
curl -fL --retry 3 -o "$work/orca.AppImage" \
  "https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v${VERSION}/${APPIMAGE}"
chmod +x "$work/orca.AppImage"
( cd "$work" && ./orca.AppImage --appimage-extract >/dev/null )
[[ -x $work/squashfs-root/AppRun ]] || { echo "В AppImage нет AppRun" >&2; exit 1; }
rm -rf "$SLICER_DIR/orca"
mv "$work/squashfs-root" "$SLICER_DIR/orca"
rm -f "$work/orca.AppImage"
ok "$SLICER_DIR/orca/AppRun"

step "Обёртка для Bambuddy (orca-slicer-api)"
mkdir -p "$work/api"
curl -fsSL --retry 3 "https://codeload.github.com/maziggy/orca-slicer-api/tar.gz/${API_COMMIT}" | tar xz -C "$work/api" --strip-components=1
( cd "$work/api" && npm ci --no-audit --no-fund && npm run build )
[[ -f $work/api/dist/src/index.js ]] || { echo "После сборки нет dist/src/index.js" >&2; exit 1; }
rm -rf "$SLICER_DIR/api"
mv "$work/api" "$SLICER_DIR/api"
mkdir -p "$SLICER_DIR/data"
ok "$SLICER_DIR/api"

# Главный риск: режет ли OrcaSlicer без экрана. Без профилей проверка грубая - провал не значит поломку.
step "Проверка: OrcaSlicer режет модель из командной строки"
mkdir -p "$work/test"
node -e '
const v=[[0,0,0],[20,0,0],[20,20,0],[0,20,0],[0,0,20],[20,0,20],[20,20,20],[0,20,20]];
const f=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
const o=["solid cube"]; for (const t of f) { o.push("facet normal 0 0 0","outer loop",...t.map(i=>"vertex "+v[i].join(" ")),"endloop","endfacet"); }
o.push("endsolid cube"); require("fs").writeFileSync(process.argv[1], o.join("\n")+"\n");' "$work/test/cube.stl"
(cd "$work/test" && env -u DISPLAY -u WAYLAND_DISPLAY timeout 180 "$SLICER_DIR/orca/AppRun" \
  --slice 0 --outputdir "$work/test" "$work/test/cube.stl" >"$work/test/log.txt" 2>&1) || true
if compgen -G "$work/test/*.gcode" >/dev/null || compgen -G "$work/test/*.3mf" >/dev/null; then
  ok "Кубик нарезан - слайсер работает."
else
  warn "Тестовый кубик не нарезался. Последние строки вывода:"
  tail -n 5 "$work/test/log.txt" | sed 's/^/      /'
  warn "Проверьте позже: lab3d slicer-test. Пока слайсер не работает, заказы идут с ценой по договорённости."
fi

echo "orca-${VERSION}|${API_COMMIT}" > "$SLICER_DIR/version.txt"
ok "Готово."
