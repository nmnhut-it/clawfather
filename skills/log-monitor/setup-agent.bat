@echo off
REM Sets up a complete log-monitor agent with heartbeat
REM Template-based — no LLM needed. Just provide the log path.
REM
REM Usage:
REM   setup-agent.bat <log-file-or-folder> [interval-minutes]
REM   setup-agent.bat C:\logs\app.log
REM   setup-agent.bat C:\logs\app.log 5

setlocal enabledelayedexpansion

set "PICO_DIR=%USERPROFILE%\.picoclaw"
set "WORKSPACE=%PICO_DIR%\workspace"
set "SCRIPT_DIR=%~dp0"
set "DEFAULT_INTERVAL=15"
set "SKILL_PATH=./skills/log-monitor/check-log.bat"

if "%~1"=="" (
  echo Usage: setup-agent.bat ^<log-file-or-folder^> [interval-minutes]
  echo.
  echo Examples:
  echo   setup-agent.bat C:\logs\app.log
  echo   setup-agent.bat C:\logs\           ^(all *.log^)
  echo   setup-agent.bat C:\logs\app.log 5  ^(5 min interval^)
  exit /b 1
)

set "LOG_TARGET=%~1"
set "INTERVAL=%~2"
if "!INTERVAL!"=="" set "INTERVAL=%DEFAULT_INTERVAL%"

if not exist "%LOG_TARGET%" (
  echo [ERROR] Path not found: %LOG_TARGET%
  exit /b 1
)

REM Create workspace directories
if not exist "%WORKSPACE%\skills\log-monitor" mkdir "%WORKSPACE%\skills\log-monitor"
if not exist "%WORKSPACE%\memory" mkdir "%WORKSPACE%\memory"

REM Copy skill scripts
copy /y "%SCRIPT_DIR%check-log.sh" "%WORKSPACE%\skills\log-monitor\" >nul 2>&1
copy /y "%SCRIPT_DIR%check-log.bat" "%WORKSPACE%\skills\log-monitor\" >nul 2>&1
echo [OK] Skill scripts copied

REM Write HEARTBEAT.md
(
echo # Heartbeat Check List
echo.
echo Execute ALL tasks below. Only respond HEARTBEAT_OK when all done.
echo.
echo ---
echo.
echo ## Log Monitoring
echo.
echo 1. Run: `exec %SKILL_PATH% %LOG_TARGET%`
echo 2. If ERROR_COUNT ^> 0 send alert. If WARN_COUNT ^> 0 send alert.
echo 3. If NO_NEW_LINES or counts are 0 no alert needed.
) > "%WORKSPACE%\HEARTBEAT.md"
echo [OK] HEARTBEAT.md configured

REM Write AGENTS.md
(
echo # Agent: Log Monitor
echo.
echo You are a log monitoring agent. Watch log files and alert on errors/warnings.
echo.
echo ## Behavior
echo - During heartbeat: run log check script and analyze output
echo - Errors found: send concise alert with top lines
echo - Warnings found: include if count ^> 3
echo - Log clean: respond HEARTBEAT_OK silently
echo.
echo ## Skills
echo.
echo ### log-monitor
echo Check log: `exec %SKILL_PATH% ^<file-or-folder^>`
echo Reset:     `exec %SKILL_PATH% --reset ^<file-or-folder^>`
) > "%WORKSPACE%\AGENTS.md"
echo [OK] AGENTS.md configured

REM Write IDENTITY.md if missing
if not exist "%WORKSPACE%\IDENTITY.md" (
  (
  echo # Identity
  echo.
  echo ## Name
  echo Log Monitor Agent
  echo.
  echo ## Description
  echo Monitors application logs and alerts on errors and warnings
  ) > "%WORKSPACE%\IDENTITY.md"
)

REM Write memory if missing
if not exist "%WORKSPACE%\memory\MEMORY.md" (
  echo # Memory > "%WORKSPACE%\memory\MEMORY.md"
)

echo.
echo ========================================================
echo   Log Monitor Agent Ready
echo   Target:    %LOG_TARGET%
echo   Interval:  every %INTERVAL% minutes
echo   Workspace: %WORKSPACE%
echo ========================================================
echo.
echo Next: run clawfather.sh to set up Telegram + LLM, then picoclaw gateway

endlocal
