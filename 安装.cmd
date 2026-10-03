@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败。请确认系统已启用 Windows PowerShell 5.1。
  pause
)
