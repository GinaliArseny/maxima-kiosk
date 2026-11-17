#Requires -RunAsAdministrator
<#
  Откат блокировки киоска: обычный рабочий стол, без автовхода и сторожа.
  Учётку «Киоск» и саму программу не удаляет. Запуск от администратора:
    powershell -ExecutionPolicy Bypass -File uninstall-kiosk.ps1
#>
param([string]$KioskUser = 'Kiosk')
$ErrorActionPreference = 'Continue'
function Ok($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Del($path, $name) {
  $p = "Registry::$path"
  if (Test-Path $p) { Remove-ItemProperty -Path $p -Name $name -ErrorAction SilentlyContinue }
}

$user = Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue
if ($user) {
  $sid = $user.SID.Value
  $userProfile = (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $sid }).LocalPath
  $loaded = Test-Path "Registry::HKEY_USERS\$sid"
  $hive = $null
  if ($loaded) { $hive = "HKEY_USERS\$sid" } elseif ($userProfile -and (Test-Path "$userProfile\NTUSER.DAT")) {
    reg load 'HKU\MaximaKioskHive' "$userProfile\NTUSER.DAT" | Out-Null
    $hive = 'HKEY_USERS\MaximaKioskHive'
  }
  if ($hive) {
    Del "$hive\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" 'Shell'
    $sys = "$hive\Software\Microsoft\Windows\CurrentVersion\Policies\System"
    'DisableTaskMgr', 'DisableLockWorkstation', 'DisableChangePassword' | ForEach-Object { Del $sys $_ }
    Del "$hive\Software\Microsoft\Windows\CurrentVersion\PushNotifications" 'ToastEnabled'
    if (-not $loaded) { [gc]::Collect(); reg unload 'HKU\MaximaKioskHive' | Out-Null }
    Ok "Учётка ${KioskUser}: обычный рабочий стол, ограничения сняты"
  }
}

Del 'HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\EdgeUI' 'AllowEdgeSwipe'
Del 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'HideFastUserSwitching'
Ok 'Свайпы и смена пользователя — как по умолчанию'

$wl = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
New-ItemProperty -Path "Registry::$wl" -Name 'AutoAdminLogon' -Value '0' -PropertyType String -Force | Out-Null
Del $wl 'DefaultPassword'
Ok 'Автовход выключен, пароль из реестра удалён'

Unregister-ScheduledTask -TaskName 'MaximaKioskWatchdog' -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:ProgramFiles 'MaximaKioskTools') -Recurse -Force -ErrorAction SilentlyContinue
Ok 'Сторож удалён'

Write-Host ''
Write-Host 'Готово. После перезагрузки — обычный вход в Windows.' -ForegroundColor Cyan
