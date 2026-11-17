#Requires -RunAsAdministrator
<#
  Блокировка Windows для киоска «Максима». Запуск от администратора:
    powershell -ExecutionPolicy Bypass -File install-kiosk.ps1
  Работает на Windows 10/11 Home, Pro, Enterprise: только реестр, планировщик и powercfg.
  Можно запускать сколько угодно раз (например, после крупного обновления Windows).
  Откат: uninstall-kiosk.ps1.
#>
param(
  [string]$KioskUser = 'Kiosk',
  [string]$ExePath = "$env:ProgramFiles\MaximaKiosk\MaximaKiosk.exe"
)
$ErrorActionPreference = 'Stop'
function Ok($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "! $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }
function Set-Reg($path, $name, $value, $type) {
  $p = "Registry::$path"
  if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
  New-ItemProperty -Path $p -Name $name -Value $value -PropertyType $type -Force | Out-Null
}

# ── 0. Проверки ─────────────────────────────────────────────────────────────
if (-not (Test-Path $ExePath)) { Fail "Нет программы $ExePath — сначала установите «MaximaKiosk Setup.exe»" }
Ok "Программа найдена: $ExePath"

$adminSid = 'S-1-5-32-544'
try {
  $others = @(Get-LocalGroupMember -SID $adminSid | Where-Object { $_.ObjectClass -eq 'User' -and $_.Name -notmatch "\\$([regex]::Escape($KioskUser))$" })
} catch { $others = @(); Warn 'Не удалось прочитать список администраторов — проверьте вручную, что есть другая учётка-администратор' }
if ($others.Count -eq 0) { Fail 'На компьютере нет другой учётки-администратора. Создайте её до блокировки — иначе обслуживать киоск будет нечем.' }
Ok "Учётка-администратор для обслуживания: $($others[0].Name)"

# ── 1. Учётка «Киоск» ───────────────────────────────────────────────────────
$user = Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue
if (-not $user) {
  $pw = Read-Host "Задайте пароль для новой учётки $KioskUser" -AsSecureString
  $user = New-LocalUser -Name $KioskUser -Password $pw -PasswordNeverExpires -AccountNeverExpires -FullName 'Киоск' -Description 'Инфокиоск «Максима»'
  Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $KioskUser
  Ok "Создана учётка $KioskUser (обычный пользователь)"
} else {
  $pw = Read-Host "Пароль учётки $KioskUser (нужен для автовхода)" -AsSecureString
  Ok "Учётка $KioskUser уже есть"
}
if (Get-LocalGroupMember -SID $adminSid | Where-Object { $_.Name -match "\\$([regex]::Escape($KioskUser))$" }) {
  Fail "$KioskUser — администратор. Уберите её из группы «Администраторы» и запустите скрипт снова."
}
$sid = $user.SID.Value

# ── 2. Профиль ──────────────────────────────────────────────────────────────
$userProfile = (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $sid }).LocalPath
if (-not $userProfile -or -not (Test-Path "$userProfile\NTUSER.DAT")) {
  Fail "У учётки $KioskUser ещё нет профиля: войдите под ней один раз, выйдите и запустите скрипт снова."
}
Ok "Профиль: $userProfile"

# ── 3. Настройки учётки «Киоск» (её ветка реестра) ─────────────────────────
$loaded = Test-Path "Registry::HKEY_USERS\$sid"
if ($loaded) { $hive = "HKEY_USERS\$sid" } else {
  reg load 'HKU\MaximaKioskHive' "$userProfile\NTUSER.DAT" | Out-Null
  $hive = 'HKEY_USERS\MaximaKioskHive'
}
try {
  Set-Reg "$hive\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" 'Shell' $ExePath 'String'
  Ok 'Вместо рабочего стола запускается киоск'
  $sys = "$hive\Software\Microsoft\Windows\CurrentVersion\Policies\System"
  Set-Reg $sys 'DisableTaskMgr' 1 'DWord'
  Set-Reg $sys 'DisableLockWorkstation' 1 'DWord'
  Set-Reg $sys 'DisableChangePassword' 1 'DWord'
  Ok 'Ctrl+Alt+Del: без диспетчера задач, блокировки и смены пароля'
  Set-Reg "$hive\Software\Microsoft\Windows\CurrentVersion\PushNotifications" 'ToastEnabled' 0 'DWord'
  Ok 'Уведомления выключены'
} finally {
  if (-not $loaded) { [gc]::Collect(); reg unload 'HKU\MaximaKioskHive' | Out-Null }
}

# ── 4. Общие настройки компьютера ───────────────────────────────────────────
Set-Reg 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\EdgeUI' 'AllowEdgeSwipe' 0 'DWord'
Ok 'Свайпы от краёв экрана выключены'
Set-Reg 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'HideFastUserSwitching' 1 'DWord'
Ok 'Быстрая смена пользователя скрыта'

$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
$wl = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-Reg $wl 'AutoAdminLogon' '1' 'String'
Set-Reg $wl 'DefaultUserName' $KioskUser 'String'
Set-Reg $wl 'DefaultDomainName' $env:COMPUTERNAME 'String'
Set-Reg $wl 'DefaultPassword' $plain 'String'
# Windows 11 «вход без пароля» мешает автовходу.
Set-Reg 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device' 'DevicePasswordLessBuildVersion' 0 'DWord'
Ok "Автовход под $KioskUser"

powercfg /change monitor-timeout-ac 0 | Out-Null
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
Ok 'Экран и компьютер не засыпают'

# ── 5. Каталог настроек программы ──────────────────────────────────────────
$cfg = Join-Path $env:ProgramData 'MaximaKiosk'
New-Item -ItemType Directory -Path $cfg -Force | Out-Null
icacls $cfg /grant "${KioskUser}:(OI)(CI)M" /T | Out-Null
Ok "Настройки программы: $cfg (учётка $KioskUser может писать)"

# ── 6. Сторож ───────────────────────────────────────────────────────────────
$tools = Join-Path $env:ProgramFiles 'MaximaKioskTools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot 'watchdog.ps1') -Destination $tools -Force
$wd = Join-Path $tools 'watchdog.ps1'
$account = "$env:COMPUTERNAME\$KioskUser"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wd`" -ExePath `"$ExePath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'MaximaKioskWatchdog' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Ok 'Сторож: если киоск упадёт, через ~10 с он снова на экране'

Write-Host ''
Write-Host 'Готово. Перезагрузите компьютер — он сам войдёт под учёткой киоска.' -ForegroundColor Cyan
Write-Host 'Обслуживание: 5 касаний в левом верхнем углу → PIN. Откат: uninstall-kiosk.ps1 от администратора.'
