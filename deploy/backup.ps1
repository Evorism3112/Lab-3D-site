<#
.SYNOPSIS
  Собирает все данные сайта и «Заказов» в один архив .tar.gz - для переезда на новый сервер
  (в том числе на Linux: deploy/linux/restore.sh) или просто как резервная копия.

.EXAMPLE
  server.bat backup              # в папку backups\ проекта
  server.bat backup D:\Копии     # в свою папку

.NOTES
  Сайт и «Заказы» на время копирования останавливает и запускает сам (server.ps1 Invoke-Backup);
  этот скрипт только собирает архив. Внутри пути те же, что в проекте, плюс database.sql:
    database.sql       - база сайта (pg_dump, обычный SQL: подходит для PostgreSQL на Linux)
    .env.production    - настройки и ключи сайта
    uploads/           - модели клиентов, фото заявок, витрина, картинки материалов
    lab/.env           - настройки «Заказов»
    lab/data/          - база «Заказов» (orders.db) и чеки/фото (uploads)
    manifest.json      - что и когда сохранено
  Bambuddy сюда не входит: у него свой бэкап (Настройки -> Резервное копирование).
#>
param([string]$OutDir = "")

. (Join-Path $PSScriptRoot "lib.ps1")
Set-Location $script:Root

if (-not $OutDir) { $OutDir = Join-Path $script:Root "backups" }
$OutDir = [IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$tar = Find-Executable "tar.exe"
if (-not $tar) { throw "Нужен tar.exe (есть в Windows 10 1803 и новее)." }

# pg_dump: из PATH или из установки PostgreSQL (winget ставит в Program Files\PostgreSQL\<версия>\bin).
# Самый новый: pg_dump не умеет выгружать сервер новее себя.
function Find-PgDump {
    $installed = @(Get-ChildItem -Path (Join-Path $env:ProgramFiles "PostgreSQL") -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "bin\pg_dump.exe") } |
        Sort-Object { [int]($_.Name -replace "\D.*$", "") } -Descending)
    if ($installed.Count) { return (Join-Path $installed[0].FullName "bin\pg_dump.exe") }
    return Find-Executable "pg_dump"
}

$config = Read-EnvFile $script:EnvFile
$dbUrl = $config["DATABASE_URL"]
if (-not $dbUrl) { throw "В .env.production нет DATABASE_URL - сайт не установлен?" }
# Параметры вроде ?schema=public понимает только Prisma, pg_dump на них ругается.
$dbUrl = ($dbUrl -split "\?")[0]

$pgDump = Find-PgDump
if (-not $pgDump) { throw "pg_dump не найден. Он ставится вместе с PostgreSQL (winget install PostgreSQL.PostgreSQL.17)." }

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$archive = Join-Path $OutDir "lab3d-backup-$stamp.tar.gz"
$staging = Join-Path ([IO.Path]::GetTempPath()) "lab3d-backup-$stamp"
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
    Write-Step "База сайта (pg_dump)"
    $sql = Join-Path $staging "database.sql"
    # Без владельцев и прав: на новом сервере пользователь базы может называться иначе.
    $dump = Invoke-Native { & $pgDump "--dbname=$dbUrl" --format=plain --no-owner --no-privileges --encoding=UTF8 "--file=$sql" }
    if ($dump.ExitCode -ne 0 -or -not (Test-Path $sql)) {
        $dump.Output | ForEach-Object { Write-Host "    $_" }
        throw "pg_dump не удался. Проверьте, что PostgreSQL запущен и DATABASE_URL в .env.production верный."
    }
    Write-Ok ("{0} ({1})" -f (Format-Size (Get-Item $sql).Length), (& $pgDump --version))

    # Что берём из папки проекта - только то, что есть (на чистой установке uploads может не быть).
    $items = @()
    $sizes = [ordered]@{}
    foreach ($rel in @(".env.production", "uploads", "lab/.env", "lab/data")) {
        $full = Join-Path $script:Root ($rel -replace "/", "\")
        if (-not (Test-Path $full)) { Write-Warn "нет $rel - пропускаю"; continue }
        $items += $rel
        $sizes[$rel] = if ((Get-Item $full).PSIsContainer) { Format-Size (Get-FolderSize $full) } else { Format-Size (Get-Item $full).Length }
    }
    foreach ($key in $sizes.Keys) { Write-Ok ("{0,-16} {1}" -f $key, $sizes[$key]) }

    $commit = (Invoke-Native { & git -C $script:Root rev-parse --short HEAD }).Output | Select-Object -First 1
    $manifest = [ordered]@{
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        machine = $env:COMPUTERNAME
        gitCommit = $commit
        pgDump = (& $pgDump --version)
        domain = $config["DEPLOY_DOMAIN"]
        contents = @("database.sql") + $items
        sizes = $sizes
        notes = "Bambuddy is not included: use its own backup (Settings -> Backup)."
    }
    [IO.File]::WriteAllText((Join-Path $staging "manifest.json"), ($manifest | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))

    Write-Step "Архив"
    # Пути внутри - как в проекте: распаковка в папку проекта на новом сервере кладёт всё на место.
    $pack = Invoke-Native { & $tar -czf $archive -C $staging manifest.json database.sql -C $script:Root @items }
    if ($pack.ExitCode -ne 0) {
        $pack.Output | ForEach-Object { Write-Host "    $_" }
        throw "Не удалось собрать архив."
    }
    # Архив читается целиком - иначе битая копия обнаружится только при переезде.
    $check = Invoke-Native { & $tar -tzf $archive }
    if ($check.ExitCode -ne 0) { throw "Архив собран, но не читается - повторите копирование." }
    Write-Ok ("{0} ({1}, файлов: {2})" -f $archive, (Format-Size (Get-Item $archive).Length), $check.Output.Count)
}
catch {
    Remove-Item $archive -Force -ErrorAction SilentlyContinue
    throw
}
finally {
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "  Готово. Не забудьте:" -ForegroundColor Green
Write-Host "    1. Bambuddy -> Настройки -> Резервное копирование: скачать его копию (принтеры, библиотека, катушки, ключи)."
Write-Host "    2. В архиве пароли и данные клиентов - переносите его на флешке или по scp, не выкладывайте в открытый доступ."
Write-Host "    3. На Linux-сервере: deploy/linux/restore.sh <архив> <папка проекта>"
