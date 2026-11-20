; Своя проверка «программа запущена?» для установщика и деинсталлятора.
;
; Штатная проверка electron-builder 26 ищет ЛЮБОЙ процесс из папки программы. При обновлении
; установщик запускает деинсталлятор старой версии прямо из этой папки — проверка находит сам
; деинсталлятор и пишет, что программу не удаётся закрыть, хотя она закрыта.
; Здесь ищем строго процесс MaximaKiosk.exe (у всех пользователей) и закрываем его принудительно.
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop $R0
  ${if} $R0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
    Quit
    DetailPrint "$(appClosing)"
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ; файлы программы должны освободиться до копирования
    Sleep 2000
  ${endIf}
!macroend
