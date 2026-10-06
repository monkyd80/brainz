@echo off
setlocal
set "APP_ROOT=%~dp0"
set "PYTHON_EXE=%APP_ROOT%.venv\Scripts\python.exe"
set "NPM_EXE=C:\Program Files\nodejs\npm.cmd"

title COM_MANAGE Startup

if not exist "%PYTHON_EXE%" (
  echo [ERROR] Python virtual environment was not found.
  echo Expected: %PYTHON_EXE%
  pause
  exit /b 1
)

if not exist "%NPM_EXE%" (
  echo [ERROR] Node.js npm was not found.
  echo Expected: %NPM_EXE%
  pause
  exit /b 1
)

sc.exe query "postgresql-x64-17" | find.exe "RUNNING" >nul
if errorlevel 1 (
  echo [WARNING] PostgreSQL service is not running.
  echo Start the PostgreSQL service, then run this file again.
  pause
  exit /b 1
)

netstat -ano | findstr /C:":8000" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "COM_MANAGE API" /min /d "%APP_ROOT%backend" "%PYTHON_EXE%" manage.py runserver 127.0.0.1:8000
)

netstat -ano | findstr /C:":3000" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "COM_MANAGE WEB" /min /d "%APP_ROOT%" "%ComSpec%" /d /c ""%APP_ROOT%COM_MANAGE_web.bat""
)

echo COM_MANAGE is starting.
echo Login URL: http://127.0.0.1:3000/
ping.exe 127.0.0.1 -n 4 >nul
start "" http://127.0.0.1:3000/
exit /b 0
