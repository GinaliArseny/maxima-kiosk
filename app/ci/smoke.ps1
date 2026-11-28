# Проверка установщика на настоящей Windows (GitHub Actions, windows-latest).
# 1) старая версия, программа закрыта → новая поверх должна встать;
# 2) переустановка поверх запущенной программы — установщик сам её закрывает;
# 3) запуск: окно живо, снимок экрана, Ctrl+Alt+Shift+Q закрывает программу.
param(
  [Parameter(Mandatory)] [string] $OldInstaller,
  [Parameter(Mandatory)] [string] $NewInstaller,
  [Parameter(Mandatory)] [string] $NewVersion,
  [string] $IntermediateInstaller,
  [string] $OldVersion = '0.1.3',
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
  if ($p.ExitCode -ne 0) { throw "Установщик завершился с ошибкой $($p.ExitCode)" }
}

Write-Host '── 1. Старая версия, программа закрыта → новая поверх'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Только одноразовый runner CI' }
Install $OldInstaller
if ((Installed-Version) -ne $OldVersion) { throw "Не установилась настоящая версия $OldVersion" }
node ./ci/seed-config.cjs
if ($LASTEXITCODE -ne 0) { throw 'Не удалось подготовить настройки' }
$config = "$env:ProgramData\MaximaKiosk\config.json"
$configHash = (Get-FileHash $config).Hash
Write-Host "  стоит: $(Installed-Version)"
if ($IntermediateInstaller) {
  Install $IntermediateInstaller
  if ((Installed-Version) -ne '0.1.5') { throw 'Не установилась 0.1.5 поверх 0.1.3' }
  if ((Get-FileHash $config).Hash -ne $configHash) { throw 'Промежуточное обновление изменило настройки' }
}
Install $NewInstaller
$v = Installed-Version
Write-Host "  стоит: $v"
if ($v -ne $NewVersion) { throw "обновление при закрытой программе не встало: стоит $v, ждали $NewVersion" }

Write-Host '── 2. Переустановка поверх ЗАПУЩЕННОЙ программы'
Start-Process $exe
Start-Sleep 15
if (-not (Kiosk-Running)) { throw 'программа не запустилась' }
Shot '1-running-before-reinstall'
Install $NewInstaller
if ((Installed-Version) -ne $NewVersion) { throw 'переустановка поверх запущенной не встала' }
if (Kiosk-Running) { throw 'после переустановки осталась работать старая копия' }

Write-Host '── 3. Запуск и аварийная комбинация'
Start-Process $exe
Start-Sleep 20
if (-not (Kiosk-Running)) { throw 'программа не запустилась после обновления' }
Shot '2-running'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^%+q')
Start-Sleep 5
Shot '3-after-emergency'
if (Kiosk-Running) { throw 'Ctrl+Alt+Shift+Q не закрыл программу' }
if ((Get-FileHash $config).Hash -ne $configHash) { throw 'Обновление изменило PIN или настройки Jellyfin' }
node ./ci/screensaver-smoke.cjs
if ($LASTEXITCODE -ne 0) { throw 'Проверка диагностики заставки не прошла' }
if ((Get-FileHash $config).Hash -ne $configHash) { throw 'Проверка изменила настройки' }
Write-Host "✓ Обновление с $OldVersion, сохранение настроек, выход и проверка заставки прошли"
