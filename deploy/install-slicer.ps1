<#
.SYNOPSIS
  Ставит (или переставляет) слайсер для точной цены на сайте: портативный Bambu Studio и
  HTTP-обёртку, через которую его вызывает Bambuddy, - в deploy\slicer, без Docker.

.EXAMPLE
  server.bat slicer

.NOTES
  Версии закреплены в lib.ps1. Работающий сервер подхватывает слайсер сам (start.ps1),
  перезапускать сайт не нужно. В конце скрипт проверяет, что Bambu Studio режет из командной
  строки. В Bambuddy Bambu Studio на 127.0.0.1:3001 выбран по умолчанию.
#>

. (Join-Path $PSScriptRoot "lib.ps1")
Set-Location $script:Root

$config = Read-EnvFile $script:EnvFile
$node = if ($config["DEPLOY_NODE"] -and (Test-Path $config["DEPLOY_NODE"])) { $config["DEPLOY_NODE"] } else { Find-Executable "node" }
if (-not $node) { throw "Node.js не найден." }
$curl = Find-Executable "curl.exe"
$tar = Find-Executable "tar.exe"
if (-not $curl -or -not $tar) { throw "Нужны curl.exe и tar.exe (есть в Windows 10 1803 и новее)." }

function Save-Download([string]$Url, [string]$Path) {
    # -sS: без полосы прогресса (окно Lab3D.exe показывает вывод построчно), но с ошибками.
    & $curl -fsSL --retry 3 -o $Path $Url
    if ($LASTEXITCODE -ne 0) { throw "Не удалось скачать $Url" }
}

New-Item -ItemType Directory -Force -Path $script:SlicerDir | Out-Null
[IO.File]::WriteAllText($script:SlicerInstallFlag, "$PID")
$download = Join-Path $script:SlicerDir "download"
try {
    # Работающий слайсер держит свои файлы - останавливаем; супервизор не запустит его, пока есть флаг.
    $state = Get-ServerState
    if ($state -and $state.slicerPid -and (Test-ProcAlive $state.slicerPid $state.slicerStart)) {
        Write-Step "Остановка работающего слайсера"
        Stop-ProcessTree $state.slicerPid
        Start-Sleep -Seconds 2
    }
    Remove-Item $download -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $download | Out-Null

    $version = $script:SlicerBambuVersion
    Write-Step "Bambu Studio $version (портативный, ~470 МБ)"
    $zip = Join-Path $download "bambu.zip"
    Save-Download "https://github.com/bambulab/BambuStudio/releases/download/v$version/Bambu_Studio_win-v$version-$($script:SlicerBambuBuild).zip" $zip
    $bambuDir = Split-Path $script:SlicerExe
    Remove-Item $bambuDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $bambuDir | Out-Null
    & $tar -xf $zip -C $bambuDir
    if ($LASTEXITCODE -ne 0) { throw "Не удалось распаковать Bambu Studio." }
    if (-not (Test-Path $script:SlicerExe)) { throw "В архиве Bambu Studio нет bambu-studio.exe." }
    # Отладочные символы нужны только разработчикам Bambu Lab, а занимают сотни мегабайт.
    Get-ChildItem -Path $bambuDir -Filter "*.pdb" | Remove-Item -Force -ErrorAction SilentlyContinue
    # Прежний слайсер (OrcaSlicer) больше не нужен.
    Remove-Item (Join-Path $script:SlicerDir "orca") -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok $script:SlicerExe

    Write-Step "Обёртка для Bambuddy (orca-slicer-api)"
    $apiZip = Join-Path $download "api.zip"
    Save-Download "https://codeload.github.com/maziggy/orca-slicer-api/zip/$($script:SlicerApiCommit)" $apiZip
    $apiSource = Join-Path $download "api"
    New-Item -ItemType Directory -Force -Path $apiSource | Out-Null
    & $tar -xf $apiZip -C $apiSource
    if ($LASTEXITCODE -ne 0) { throw "Не удалось распаковать orca-slicer-api." }
    $unpacked = Get-ChildItem -Path $apiSource -Directory | Select-Object -First 1
    if (-not $unpacked) { throw "Архив orca-slicer-api пуст." }
    Remove-Item $script:SlicerApiDir -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item -Path $unpacked.FullName -Destination $script:SlicerApiDir
    Push-Location $script:SlicerApiDir
    try {
        & npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci для orca-slicer-api не удался." }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Сборка orca-slicer-api не удалась." }
    }
    finally { Pop-Location }
    if (-not (Test-Path $script:SlicerApiEntry)) { throw "После сборки нет $($script:SlicerApiEntry)." }
    New-Item -ItemType Directory -Force -Path $script:SlicerDataDir | Out-Null
    Write-Ok $script:SlicerApiDir

    # Главный риск без Docker: режет ли Windows-версия из командной строки. Проверяем на кубике.
    Write-Step "Проверка: Bambu Studio режет модель из командной строки"
    $test = Join-Path $download "test"
    New-Item -ItemType Directory -Force -Path $test | Out-Null
    $cube = Join-Path $test "cube.stl"
    $v = @((0,0,0),(20,0,0),(20,20,0),(0,20,0),(0,0,20),(20,0,20),(20,20,20),(0,20,20))
    $faces = @((0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7))
    $lines = @("solid cube")
    foreach ($f in $faces) {
        $lines += "facet normal 0 0 0", "outer loop"
        foreach ($i in $f) { $lines += ("vertex {0} {1} {2}" -f $v[$i][0], $v[$i][1], $v[$i][2]) }
        $lines += "endloop", "endfacet"
    }
    $lines += "endsolid cube"
    [IO.File]::WriteAllLines($cube, $lines)
    $slice = Start-Process -FilePath $script:SlicerExe -ArgumentList @("--slice", "0", "--outputdir", "`"$test`"", "`"$cube`"") `
        -WorkingDirectory $test -PassThru -WindowStyle Hidden
    if (-not $slice.WaitForExit(180000)) { Stop-ProcessTree $slice.Id; $sliceOk = $false }
    else { $sliceOk = [bool](Get-ChildItem -Path $test -Include "*.gcode", "*.3mf" -Recurse -ErrorAction SilentlyContinue) }
    if ($sliceOk) { Write-Ok "Кубик нарезан - слайсер работает." }
    else {
        # Без профилей принтера проверка грубая: провал - повод проверить, а не обязательно поломка.
        Write-Warn ("Тестовый кубик не нарезался (код {0})." -f $(if ($slice.HasExited) { $slice.ExitCode } else { "таймаут" }))
        Write-Warn "Проверьте нарезку в Bambuddy: Файловый менеджер -> у файла кнопка «Нарезать» (шестерёнка). Если и там ошибка, сайт будет показывать примерную цену."
    }

    [IO.File]::WriteAllText($script:SlicerVersionFile, (Get-SlicerVersionTag))
}
finally {
    Remove-Item $script:SlicerInstallFlag -Force -ErrorAction SilentlyContinue
    Remove-Item $download -Recurse -Force -ErrorAction SilentlyContinue
}

# Bambuddy по умолчанию режет через Bambu Studio на 127.0.0.1:3001; менять его настройки ключам API
# запрещено, так что если там выбрано другое - поправить нужно вручную.
$needsKeyFlag = -not $config["BAMBUDDY_API_KEY"]
if (Get-ServerState) {
    Write-Step "Запуск слайсера"
    $up = $false
    for ($i = 0; $i -lt 30 -and -not $up; $i++) {
        Start-Sleep -Seconds 2
        try { Invoke-WebRequest -Uri "http://127.0.0.1:$($script:SlicerPort)/health" -UseBasicParsing -TimeoutSec 10 | Out-Null; $up = $true } catch { }
    }
    if ($up) { Write-Ok "Слайсер отвечает на 127.0.0.1:$($script:SlicerPort)." }
    else { Write-Warn "Слайсер не ответил за минуту - смотрите deploy\logs\slicer-error.log" }
}
else { Write-Ok "Слайсер запустится вместе с сервером." }
Write-Host ""
Write-Host "  Готово. Осталось:" -ForegroundColor Green
Write-Host "    1. Bambuddy -> Настройки -> Рабочий процесс -> «Слайсер»: слайсер Bambu Studio, включить «Использовать API слайсера», адрес пустой или http://127.0.0.1:$($script:SlicerPort)"
if ($needsKeyFlag) { Write-Host "    2. Создать ключ API в Bambuddy (Read status, Control printer, Manage library) и вписать его на вкладке «Принтеры»" }
else { Write-Host "    2. У ключа API в Bambuddy должно быть включено «Manage library»" }
Write-Host "    3. Админка сайта: Цены -> «Точная цена через слайсер» - выбрать принтер и процесс (после смены слайсера - заново)"
