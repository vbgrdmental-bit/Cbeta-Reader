@echo off
cd /d "%~dp0"
netstat -ano | findstr :5188 >nul
if errorlevel 1 (
  start /min "" cmd /c "npm run dev"
  timeout /t 2 /nobreak >nul
)
start "" "http://localhost:5188/"
exit
