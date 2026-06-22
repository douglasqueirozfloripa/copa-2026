@echo off
REM ============================================================
REM iniciar.bat - Windows: clique 2x para subir o app da Copa 2026.
REM Faz: (1) instala dependencias se faltarem, (2) sobe o server.js
REM (que captura na FIFA, aplica os placares e abre o navegador).
REM ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)

if not exist node_modules\playwright (
  echo Instalando dependencias ^(primeira vez^)...
  call npm install playwright || ( echo Falha no npm install & pause & exit /b 1 )
  call npx playwright install chromium
)

echo Subindo o atualizador... ^(deixe esta janela aberta enquanto usa o app^)
echo Para desligar: feche esta janela ou pressione Ctrl+C.
node server.js
pause
