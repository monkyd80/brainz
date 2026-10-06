@echo off
setlocal
cd /d "%~dp0frontend"
call "C:\Program Files\nodejs\npm.cmd" run dev -- --hostname 127.0.0.1 --port 3000
