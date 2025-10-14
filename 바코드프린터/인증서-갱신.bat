@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ===============================================
echo === localhost.pem 생성 ===
echo ===============================================
echo.

REM PC 이름
set PC_NAME=%COMPUTERNAME%
echo 🖥️ PC 이름: %PC_NAME%
echo.

REM 기존 파일 삭제
echo 🗑️ 기존 파일 삭제...
del localhost*.pem >nul 2>&1
echo ✅ 삭제 완료
echo.

REM 인증서 생성
echo 🔐 인증서 생성 중...
mkcert localhost 127.0.0.1 ::1 %PC_NAME% %PC_NAME%.local
echo.

REM 와일드카드로 파일 찾기

for %%f in (localhost*-key.pem) do (
    echo   - 발견: %%f  
    ren "%%f" "localhost-key.pem"
    echo ✅ %%f → localhost-key.pem 변경
    goto :key_done
)
:key_done

echo 🔄 파일명 변경...
for %%f in (localhost+*.pem) do (
    echo   - 발견: %%f
    ren "%%f" "localhost.pem"
    echo ✅ %%f → localhost.pem 변경
    goto :cert_done
)
:cert_done

if exist "localhost-key.pem" (
    ren "localhost-key.pem" "localhost+2-key.pem"
    echo ✅ localhost-key.pem → localhost+2-key.pem 변경
)

if exist "localhost.pem" (
    ren "localhost.pem" "localhost+2.pem"
    echo ✅ localhost.pem → localhost+2.pem 변경
)


echo.
REM 결과 확인
if exist "localhost.pem" (
    if exist "localhost-key.pem" (
        echo ===============================================
        echo ✅ localhost.pem 생성 완료!
        echo ===============================================
        echo.
        echo 📁 생성된 파일:
        echo   ✅ localhost.pem
        echo   ✅ localhost-key.pem
        echo.
        echo 🌐 접근 가능한 주소:
        echo - https://localhost:8443
        echo - https://%PC_NAME%:8443
        echo - https://%PC_NAME%.local:8443 (권장)
        echo.
        echo 🔄 TSC 프린터 서버를 재시작하세요!
    ) else (
        echo ❌ localhost-key.pem 파일 없음
    )
) else (
    echo ❌ localhost.pem 파일 없음
)

echo.
echo ===============================================
pause