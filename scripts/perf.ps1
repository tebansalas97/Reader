param(
    [string]$Exe = "src-tauri/target/release/reader.exe",
    [string]$Out = "docs/perf.md",
    [int]$Runs = 5
)

$ErrorActionPreference = "Stop"

function New-Fixture {
    param([string]$Path, [int]$Kilobytes)

    $block = @"
## Seccion

Texto de prueba con **negrita**, *cursiva* y un enlace a [algun sitio](https://ejemplo.com).

- uno
- dos
- tres

| a | b |
| - | - |
| 1 | 2 |

"@
    $sb = [System.Text.StringBuilder]::new()
    while ($sb.Length -lt $Kilobytes * 1024) { [void]$sb.Append($block) }
    Set-Content -Path $Path -Value $sb.ToString() -Encoding utf8
}

function Get-Tree {
    param([int]$RootId)

    $ids = @($RootId)
    $queue = @($RootId)
    while ($queue.Count -gt 0) {
        $current = $queue[0]
        $queue = @($queue | Select-Object -Skip 1)
        foreach ($child in (Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue)) {
            if ($ids -notcontains $child.ProcessId) {
                $ids += $child.ProcessId
                $queue += $child.ProcessId
            }
        }
    }
    return $ids
}

function Use-CleanPrefs {
    $folder = Join-Path $env:APPDATA "dev.esteban.reader"
    $file = Join-Path $folder "prefs.json"
    $backup = Join-Path $folder "prefs.perf-backup.json"
    if (-not (Test-Path $file)) { return $null }
    if (Test-Path $backup) { Copy-Item $backup $file -Force }
    Copy-Item $file $backup -Force
    $json = Get-Content $file -Raw | ConvertFrom-Json
    $json | Add-Member -NotePropertyName restoreSession -NotePropertyValue $false -Force
    $json | Add-Member -NotePropertyName session -NotePropertyValue @() -Force
    [System.IO.File]::WriteAllText($file, ($json | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
    return $backup
}

function Restore-Prefs {
    param([string]$Backup)
    if (-not $Backup) { return }
    if (-not (Test-Path $Backup)) { return }
    $file = Join-Path (Split-Path $Backup) "prefs.json"
    Copy-Item $Backup $file -Force
    Remove-Item $Backup -Force
}

function Measure-Launch {
    param([string]$File)

    $times = @()
    $working = 0
    $private = 0
    foreach ($i in 1..$Runs) {
        $watch = [System.Diagnostics.Stopwatch]::StartNew()
        $proc = Start-Process -FilePath $Exe -ArgumentList $File -PassThru
        $proc.WaitForInputIdle(30000) | Out-Null
        $watch.Stop()
        $times += $watch.ElapsedMilliseconds
        Start-Sleep -Seconds 4
        $working = 0
        $private = 0
        foreach ($id in (Get-Tree -RootId $proc.Id)) {
            $one = Get-Process -Id $id -ErrorAction SilentlyContinue
            if ($one) {
                $working += $one.WorkingSet64
                $private += $one.PrivateMemorySize64
            }
        }
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 1200
    }
    $sorted = $times | Sort-Object
    return [pscustomobject]@{
        MedianMs   = $sorted[[int]($sorted.Count / 2)]
        MinMs      = $sorted[0]
        MaxMs      = $sorted[-1]
        WorkingMb  = [math]::Round($working / 1MB, 1)
        PrivateMb  = [math]::Round($private / 1MB, 1)
    }
}

$fixtures = "tests/fixtures"
if (-not (Test-Path $fixtures)) { New-Item -ItemType Directory -Force $fixtures | Out-Null }
Set-Content -Path "$fixtures/perf-empty.md" -Value "" -Encoding utf8
New-Fixture -Path "$fixtures/perf-small.md" -Kilobytes 100
New-Fixture -Path "$fixtures/perf-large.md" -Kilobytes 5120

$backup = Use-CleanPrefs
try {
    Write-Output "Midiendo con documento vacio..."
    $empty = Measure-Launch -File "$fixtures/perf-empty.md"
    Write-Output "Midiendo con documento de 100 KB..."
    $small = Measure-Launch -File "$fixtures/perf-small.md"
    Write-Output "Midiendo con documento de 5 MB..."
    $large = Measure-Launch -File "$fixtures/perf-large.md"
} finally {
    Restore-Prefs -Backup $backup
}

$binary = Get-Item $Exe
$installer = Get-ChildItem "src-tauri/target/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$installerMb = if ($installer) { "{0:N1} MB" -f ($installer.Length / 1MB) } else { "no compilado" }

$report = @"
# Rendimiento

Medido el $(Get-Date -Format 'yyyy-MM-dd HH:mm') en $($env:COMPUTERNAME).
Mediana de $Runs arranques en frio por documento.

## Tamano en disco

| Artefacto | Presupuesto | Medido |
| --- | --- | --- |
| Instalador NSIS | menos de 15 MB | $installerMb |
| Ejecutable | sin presupuesto | $("{0:N1} MB" -f ($binary.Length / 1MB)) |

## Arranque

| Documento | Presupuesto | Mediana | Minimo | Maximo |
| --- | --- | --- | --- | --- |
| Vacio | menos de 600 ms | $($empty.MedianMs) ms | $($empty.MinMs) ms | $($empty.MaxMs) ms |
| 100 KB | menos de 600 ms | $($small.MedianMs) ms | $($small.MinMs) ms | $($small.MaxMs) ms |
| 5 MB | menos de 800 ms | $($large.MedianMs) ms | $($large.MinMs) ms | $($large.MaxMs) ms |

El tiempo va desde lanzar el proceso hasta que la ventana acepta entrada.

## Memoria

| Documento | Conjunto de trabajo | Memoria privada | Sobre el suelo |
| --- | --- | --- | --- |
| Vacio | $($empty.WorkingMb) MB | $($empty.PrivateMb) MB | |
| 100 KB | $($small.WorkingMb) MB | $($small.PrivateMb) MB | +$([math]::Round($small.PrivateMb - $empty.PrivateMb, 1)) MB |
| 5 MB | $($large.WorkingMb) MB | $($large.PrivateMb) MB | +$([math]::Round($large.PrivateMb - $empty.PrivateMb, 1)) MB |

Suma del proceso principal y de todos los procesos de WebView2 que cuelgan de el.
El conjunto de trabajo cuenta varias veces las paginas de Chromium compartidas entre
procesos, asi que la memoria privada es la cifra honesta.

Con un documento vacio la aplicacion ya consume $($empty.PrivateMb) MB: ese es el
suelo de WebView2, que arranca siete procesos de Chromium, y lo paga cualquier
aplicacion que lo use. Ese suelo se mueve con la version del runtime que tenga
instalada Windows, asi que las cifras de dos informes con fechas distintas solo se
pueden comparar por la columna de la derecha, que es lo unico que depende de
nosotros.

Las mediciones se hacen con la sesion desactivada, para que no cuente lo que
hubiera abierto la ultima vez.
"@

Set-Content -Path $Out -Value $report -Encoding utf8
Write-Output ""
Write-Output $report
