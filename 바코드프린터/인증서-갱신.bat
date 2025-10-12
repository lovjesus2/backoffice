@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo === TSC 인증서 갱신 (고정 파일명) ===
echo.

REM PC 이름 가져오기
set PC_NAME=%COMPUTERNAME%
echo ✅ PC 이름: %PC_NAME%
echo 🌐 .local 도메인: %PC_NAME%.local
echo.

REM 기존 인증서 백업 및 삭제
if exist "localhost.pem" (
    echo 📦 기존 인증서 백업 중...
    copy "localhost.pem" "localhost.pem.backup" >nul
    copy "localhost-key.pem" "localhost-key.pem.backup" >nul
    del "localhost.pem" >nul 2>&1
    del "localhost-key.pem" >nul 2>&1
    echo ✅ 기존 인증서 정리 완료
    echo.
)

REM mkcert 기존 파일들 정리 (카운팅 방지)
if exist "localhost+*.pem" (
    echo 🧹 기존 mkcert 파일들 정리 중...
    del "localhost+*.pem" >nul 2>&1
    echo ✅ 정리 완료
    echo.
)

REM PC 이름을 포함한 새 인증서 생성
echo 🔐 새 인증서 생성 중...
echo 포함될 도메인:
echo - localhost
echo - 127.0.0.1  
echo - ::1
echo - %PC_NAME%
echo - %PC_NAME%.local (mDNS)
echo.

mkcert localhost 127.0.0.1 ::1 %PC_NAME% %PC_NAME%.local

if %errorlevel% equ 0 (
    REM 생성된 파일 자동 감지 및 이름 변경
    echo 📝 생성된 파일 확인 중...
    
    REM localhost+숫자.pem 패턴의 파일 찾기
    for %%f in (localhost+*.pem) do (
        set GENERATED_FILE=%%f
        set KEY_FILE=%%~nf-key.pem
        goto :found
    )
    
    REM localhost.pem이 이미 존재하는 경우
    if exist "localhost.pem" (
        echo ✅ localhost.pem으로 생성됨
        goto :cert_info
    )
    
    echo ❌ 생성된 인증서 파일을 찾을 수 없습니다!
    goto :end
    
    :found
    echo 📝 파일명 정리: %GENERATED_FILE% → localhost.pem
    ren "%GENERATED_FILE%" "localhost.pem"
    ren "%KEY_FILE%" "localhost-key.pem"
    
    :cert_info
    
    echo.
    echo ✅ 새 인증서 생성 완료!
    echo 📄 파일명: localhost.pem / localhost-key.pem
    echo.
    echo 📋 인증서 정보:
    powershell -Command "& {$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('localhost.pem'); Write-Host '발급일: ' $cert.NotBefore; Write-Host '만료일: ' $cert.NotAfter}"
    echo.
    echo 🌐 접근 가능한 주소:
    echo - https://localhost:8443 (PC에서)
    echo - https://%PC_NAME%:8443 (모바일에서)
    echo - https://%PC_NAME%.local:8443 (모바일에서)
    echo.
    echo ⚠️ TSC 서버를 재시작하세요!
    
    :end
) else (
    echo.
    echo ❌ 인증서 생성 실패!
    echo mkcert가 설치되어 있는지 확인하세요.
)

echo.
pause