@echo off
rem Removes the "ohmyopen:" URL protocol registered by register.cmd.
reg delete "HKCU\Software\Classes\ohmyopen" /f >nul
if errorlevel 1 (
  echo Nothing to remove, or removal failed.
) else (
  echo Removed.
)
pause
