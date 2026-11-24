# Проверка установщика на настоящей Windows (GitHub Actions, windows-latest).
# 1) старая версия, программа закрыта → новая поверх должна встать;
# 2) переустановка поверх запущенной программы — установщик сам её закрывает;
# 3) запуск: окно живо, снимок экрана, Ctrl+Alt+Shift+Q закрывает программу.
param(
  [Parameter(Mandatory)] [string] $OldInstaller,
  [Parameter(Mandatory)] [string] $LegacyInstaller,
  [Parameter(Mandatory)] [string] $NewInstaller,
  [Parameter(Mandatory)] [string] $NewVersion,
  [string] $ShotsDir = "$PWD\shots"
)
$ErrorActionPreference = 'Stop'
$exe = 'C:\Program Files\MaximaKioskTest\MaximaKioskTest.exe'
New-Item -ItemType Directory -Force $ShotsDir | Out-Null

function Installed-Version {
  $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  (Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'MaximaKioskTest' } | Select-Object -First 1).DisplayVersion
}
function Kiosk-Running { [bool](Get-Process MaximaKioskTest -ErrorAction SilentlyContinue) }
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
  if ($p.ExitCode -ne 0) { throw "Ошибка установщика: $($p.ExitCode)" }
}

# Только одноразовый runner CI: моделируем сломанный деинсталлятор старого продукта.
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Этот тест предназначен только для GitHub Actions' }
Install $LegacyInstaller
$legacyExe = 'C:\Program Files\MaximaKiosk\MaximaKiosk.exe'
$legacyUninstall = 'C:\Program Files\MaximaKiosk\Uninstall MaximaKiosk.exe'
$legacyHash = (Get-FileHash $legacyExe).Hash
[IO.File]::WriteAllText($legacyUninstall, 'CI fixture: damaged old uninstaller')
$brokenHash = (Get-FileHash $legacyUninstall).Hash
$legacyConfigDir = "$env:ProgramData\MaximaKiosk"
New-Item -ItemType Directory -Force $legacyConfigDir | Out-Null
$legacyConfig = Join-Path $legacyConfigDir 'config.json'
[IO.File]::WriteAllText($legacyConfig, '{"ciSentinel":true}')
$configHash = (Get-FileHash $legacyConfig).Hash

function Assert-LegacyUnchanged {
  if ((Get-FileHash $legacyExe).Hash -ne $legacyHash) { throw 'Изменён старый exe' }
  if ((Get-FileHash $legacyUninstall).Hash -ne $brokenHash) { throw 'Изменён старый деинсталлятор' }
  if ((Get-FileHash $legacyConfig).Hash -ne $configHash) { throw 'Изменены старые настройки' }
  $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  if (-not (Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'MaximaKiosk' })) { throw 'Удалена запись старой установки' }
}

Write-Host '── 1. Старая версия, программа закрыта → новая поверх'
Install $OldInstaller
Write-Host "  стоит: $(Installed-Version)"
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
Assert-LegacyUnchanged
if (-not (Test-Path "$env:APPDATA\MaximaKioskTest")) { throw 'Отдельный профиль не создан' }

Write-Host '── 4. Удаление тестовой версии при сломанном старом деинсталляторе'
$p = Start-Process 'C:\Program Files\MaximaKioskTest\Uninstall MaximaKioskTest.exe' -ArgumentList '/S' -PassThru -Wait
if ($p.ExitCode -ne 0) { throw 'Ошибка удаления тестовой версии' }
Start-Sleep 5
if (Test-Path $exe) { throw 'Тестовый exe остался после удаления' }
if (Installed-Version) { throw 'Осталась запись тестовой установки' }
Assert-LegacyUnchanged
Write-Host '✓ всё прошло'
