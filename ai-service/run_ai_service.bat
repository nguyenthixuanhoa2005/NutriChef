@echo off
setlocal
cd /d "%~dp0"

if not exist ".\venv\Scripts\python.exe" (
  echo [ERROR] Khong tim thay .\venv\Scripts\python.exe
  pause
  exit /b 1
)

echo [INFO] Su dung Python tu venv...
".\venv\Scripts\python.exe" ai_services.py
endlocal
