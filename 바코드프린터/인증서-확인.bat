@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo === TSC 인증서 정보 확인 ===
echo 현재 폴더: %CD%
echo.

if exist "localhost+2.pem" (
    echo ✅ 인증서 파일: localhost+2.pem
    echo.
    
    REM PowerShell로 인증서 정보 확인
    powershell -Command "& {$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('localhost+2.pem'); $daysLeft = ([DateTime]$cert.NotAfter - [DateTime]::Now).Days; Write-Host '발급일: ' $cert.NotBefore; Write-Host '만료일: ' $cert.NotAfter; Write-Host '남은 기간: ' $daysLeft '일'; if ($daysLeft -lt 30) { Write-Host '⚠️  경고: 30일 이내 만료!' -ForegroundColor Yellow } elseif ($daysLeft -lt 90) { Write-Host '⚠️  주의: 90일 이내 만료' -ForegroundColor Orange } else { Write-Host '✅ 인증서 정상' -ForegroundColor Green }; Write-Host '주체: ' $cert.Subject}"
    echo.
    
    REM 만료 임박 시 갱신 안내
    powershell -Command "& {$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('localhost+2.pem'); $daysLeft = ([DateTime]$cert.NotAfter - [DateTime]::Now).Days; if ($daysLeft -lt 90) { Write-Host ''; Write-Host '=== 인증서 갱신 방법 ==='; Write-Host '1. 인증서-갱신.bat 실행'; Write-Host '2. 또는 수동: mkcert localhost 127.0.0.1 ::1'; Write-Host '3. TSC 서버 재시작'; Write-Host '=========================' }}"
    
) else (
    echo ❌ localhost+2.pem 파일이 없습니다.
    echo.
    echo 인증서 생성: mkcert localhost 127.0.0.1 ::1
)

echo.
echo 참고: mkcert 인증서는 기본 2-10년 유효기간을 가집니다.
echo 현재 인증서는 2027년 11월 10일까지 유효합니다.
pause