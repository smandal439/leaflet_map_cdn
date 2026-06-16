@echo off
title Python HTTP Server
echo Starting Python HTTP server on port 8000...
start "Python HTTP Server" cmd /k "cd /d "%~dp0" && python -m http.server 8000"
start "" "chrome" "http://127.0.0.1:8000"
pause
