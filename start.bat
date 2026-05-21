@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/2] 패키지 설치 중...
call npm install
if errorlevel 1 (
  echo npm install 실패. Node.js가 설치되어 있는지 확인하세요.
  pause
  exit /b 1
)
echo.
echo [2/2] 개발 서버 시작...
echo 브라우저에서 http://localhost:5173 을 여세요.
echo 종료하려면 Ctrl+C
call npm run dev
pause
