<#
  Сторож киоска: запускается планировщиком при входе учётки «Киоск».
  Раз в 10 с: программы нет и владелец не выходил по PIN (нет флага) — запустить снова.
#>
param([Parameter(Mandatory = $true)][string]$ExePath)
$flag = Join-Path $env:ProgramData 'MaximaKiosk\service-exit'
$name = [IO.Path]::GetFileNameWithoutExtension($ExePath)
Start-Sleep -Seconds 20
while ($true) {
  if (-not (Test-Path $flag) -and -not (Get-Process -Name $name -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $ExePath
  }
  Start-Sleep -Seconds 10
}
