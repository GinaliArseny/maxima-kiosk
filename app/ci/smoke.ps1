# Проверка установщика на настоящей Windows (GitHub Actions, windows-latest).
# 1) ставим «старую» версию и запускаем её;
# 2) поверх ставим новую — установщик должен сам закрыть старую и встать;
# 3) запускаем новую: окно живо, снимок экрана, Ctrl+Alt+Shift+Q закрывает программу.
param(
  [Parameter(Mandatory)] [string] $OldInstaller,
  [Parameter(Mandatory)] [string] $NewInstaller,
  [Parameter(Mandatory)] [string] $NewVersion,
  [string] $ShotsDir = "$PWD\shots"
)
$ErrorActionPreference = 'Stop'
$exe = 'C:\Program Files\MaximaKiosk\MaximaKiosk.exe'
New-Item -ItemType Directory -Force $ShotsDir | Out-Null

function Installed-Version {
  $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  (Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'MaximaKiosk*' } | Select-Object -First 1).DisplayVersion
}
function Kiosk-Running { [bool](Get-Process MaximaKiosk -ErrorAction SilentlyContinue) }
function Shot([string] $name) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save("$ShotsDir\$name.png")
  $g.Dispose(); $bmp.Dispose()
}
function Install([string] $installer) {
  $p = Start-Process $installer -ArgumentList '/S' -PassThru -Wait
  Write-Host "установщик $(Split-Path $installer -Leaf): код $($p.ExitCode)"
}

Write-Host '── 1. Старая версия'
Install $OldInstaller
Write-Host "  стоит: $(Installed-Version)"
Start-Process $exe
Start-Sleep 15
if (-not (Kiosk-Running)) { throw 'старая версия не запустилась' }
Shot '1-old-running'

Write-Host '── 2. Новая поверх запущенной старой'
Install $NewInstaller
$v = Installed-Version
Write-Host "  стоит: $v"
if ($v -ne $NewVersion) { throw "обновление не встало: стоит $v, ждали $NewVersion" }
if (Kiosk-Running) { throw 'после обновления осталась старая программа' }

Write-Host '── 3. Новая: запуск и аварийная комбинация'
Start-Process $exe
Start-Sleep 20
if (-not (Kiosk-Running)) { throw 'новая версия не запустилась' }
Shot '2-new-running'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^%+q')
Start-Sleep 5
Shot '3-after-emergency'
if (Kiosk-Running) { throw 'Ctrl+Alt+Shift+Q не закрыл программу' }
Write-Host '✓ всё прошло'
