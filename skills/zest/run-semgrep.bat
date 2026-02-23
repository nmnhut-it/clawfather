@echo off
REM Runs Semgrep security scan, auto-locating semgrep if not in PATH
REM Usage: run-semgrep.bat <file_or_directory> [extra_args...]

setlocal enabledelayedexpansion

set "TARGET=%~1"
if "%TARGET%"=="" (
  echo Usage: run-semgrep.bat ^<file_or_directory^> [extra_args...]
  exit /b 1
)
shift

REM Find semgrep - try PATH first, then pip installation
set "SEMGREP="
where semgrep >nul 2>nul
if !errorlevel!==0 (
  set "SEMGREP=semgrep"
) else (
  REM Use find-semgrep helper
  for /f "delims=" %%a in ('%~dp0find-semgrep.bat path 2^>nul') do set "SEMGREP=%%a"
)

if not defined SEMGREP (
  echo ERROR: semgrep not found. Install with: pip install semgrep >&2
  echo   Or run: exec .\skills\zest\install-tools.bat >&2
  exit /b 1
)

"%SEMGREP%" --config "p/java" --config "p/owasp-top-ten" --json "%TARGET%" %*
exit /b !errorlevel!
