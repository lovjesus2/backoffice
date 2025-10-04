@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo === TSC 인증서 갱신 ===
echo.

REM 기존 인증서 백업
if exist "localhost+2.pem" (
    echo 기존 인증서 백업 중...
    copy "localhost+2.pem" "localhost+2.pem.backup" >nul
    copy "localhost+2-key.pem" "localhost+2-key.pem.backup" >nul
    echo ✅ 백업 완료
)

REM 새 인증서 생성
echo 새 인증서 생성 중...
mkcert localhost 127.0.0.1 ::1

if %errorlevel% equ 0 (
    echo ✅ 새 인증서 생성 완료
    echo.
    echo 새 인증서 정보:
    powershell -Command "& {$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('localhost+2.pem'); Write-Host '발급일: ' $cert.NotBefore; Write-Host '만료일: ' $cert.NotAfter}"
    echo.
    echo TSC 서버를 재시작하세요.
) else (
    echo ❌ 인증서 생성 실패
    echo mkcert가 설치되어 있는지 확인하세요.
)

pause