@echo off
rem Registers the "ohmyopen:" URL protocol for the CURRENT USER (no admin rights needed).
rem Run once per PC. Re-run after moving this folder. Undo with unregister.cmd.
setlocal
set "OPENER=%~dp0opener.js"

if not exist "%OPENER%" (
  echo opener.js not found next to this script.
  pause
  exit /b 1
)

reg add "HKCU\Software\Classes\ohmyopen" /ve /d "URL:OhmyManual Opener" /f >nul
reg add "HKCU\Software\Classes\ohmyopen" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\ohmyopen\shell\open\command" /ve /d "wscript.exe //Nologo \"%OPENER%\" \"%%1\"" /f >nul

if errorlevel 1 (
  echo Registration failed. Registry writes may be blocked by policy.
  pause
  exit /b 1
)

echo Registered. Attachment links now open with the default program.
echo Opener: %OPENER%
echo On the first click, choose "Always allow" in the Edge prompt.
pause
