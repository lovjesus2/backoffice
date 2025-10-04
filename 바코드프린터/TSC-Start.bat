@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
cls
echo 🔐 TSC TTP-244 Pro 에이전트 시작 중... (mkcert)
echo ================================================
echo.
node tsc-server.js