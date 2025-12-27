@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ===============================================
echo === mkcert 루트 CA 설치 + 인증서 생성 ===
echo ===============================================
echo.

REM 1단계: 루트 CA 설치 (한 번만 실행)
echo 🔐 1단계: mkcert 루트 CA 설치 중...
mkcert -install
if errorlevel 1 (
    echo ❌ 루트 CA 설치 실패
    pause
    exit /b 1
)
echo ✅ 루트 CA 설치 완료
echo.

REM 2단계: 루트 CA 파일 복사
echo 📋 2단계: 루트 CA 파일 복사...
set MKCERT_ROOT=%LOCALAPPDATA%\mkcert\rootCA.pem

if exist "%MKCERT_ROOT%" (
    copy "%MKCERT_ROOT%" "rootCA.pem" >nul 2>&1
    if exist "rootCA.pem" (
        echo ✅ rootCA.pem 복사 완료
    ) else (
        echo ❌ rootCA.pem 복사 실패
    )
    
    REM 안드로이드용 .crt 파일도 생성
    copy "%MKCERT_ROOT%" "rootCA.crt" >nul 2>&1
    if exist "rootCA.crt" (
        echo ✅ rootCA.crt 복사 완료 (안드로이드용)
    ) else (
        echo ❌ rootCA.crt 복사 실패
    )
) else (
    echo ⚠️ 루트 CA 파일을 찾을 수 없습니다
    echo    위치: %MKCERT_ROOT%
)
echo.

REM PC 이름 및 IP 자동 감지
set PC_NAME=%COMPUTERNAME%
echo 🖥️ PC 이름: %PC_NAME%

REM IP 주소 자동 감지 (IPv4만)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP_TEMP=%%a
    set IP_ADDR=!IP_TEMP:~1!
    goto :ip_found
)
:ip_found
echo 📡 로컬 IP: %IP_ADDR%
echo.

REM 기존 서버 인증서 삭제
echo 🗑️ 기존 서버 인증서 삭제...
del localhost*.pem >nul 2>&1
echo ✅ 삭제 완료
echo.

REM 3단계: 서버 인증서 생성 (IP 자동 포함)
echo 🔐 3단계: 서버 인증서 생성 중...
echo    - localhost, 127.0.0.1, %IP_ADDR%, %PC_NAME%.local 포함
mkcert localhost 127.0.0.1 %IP_ADDR% ::1 %PC_NAME% %PC_NAME%.local
if errorlevel 1 (
    echo ❌ 인증서 생성 실패
    pause
    exit /b 1
)
echo ✅ 인증서 생성 완료
echo.

REM 파일명 변경 (간단한 방식)
echo 🔄 파일명 확인...

REM 생성된 파일 찾기
set FOUND_CERT=
set FOUND_KEY=

for %%f in (localhost+*.pem) do (
    echo %%f | findstr /C:"-key.pem" >nul
    if errorlevel 1 (
        REM key가 아닌 파일 = 인증서
        set FOUND_CERT=%%f
    ) else (
        REM key 파일 = 개인키
        set FOUND_KEY=%%f
    )
)

echo   인증서: !FOUND_CERT!
echo   개인키: !FOUND_KEY!
echo.

REM 파일명이 이미 올바르면 변경 안 함
if "!FOUND_CERT!"=="localhost+2.pem" (
    echo ✅ 인증서 파일명 이미 올바름
) else (
    if defined FOUND_CERT (
        ren "!FOUND_CERT!" "localhost+2.pem"
        echo ✅ !FOUND_CERT! → localhost+2.pem 변경
    )
)

if "!FOUND_KEY!"=="localhost+2-key.pem" (
    echo ✅ 개인키 파일명 이미 올바름
) else (
    if defined FOUND_KEY (
        ren "!FOUND_KEY!" "localhost+2-key.pem"
        echo ✅ !FOUND_KEY! → localhost+2-key.pem 변경
    )
)

echo.
REM 결과 확인
echo ===============================================
echo 🎉 인증서 갱신 완료!
echo ===============================================
echo.
echo 📁 생성된 파일 목록:
dir /b localhost+2*.pem 2>nul
dir /b rootCA.* 2>nul
echo.
echo 🔄 프린터 서버를 재시작하세요!
echo.
echo ===============================================
pause