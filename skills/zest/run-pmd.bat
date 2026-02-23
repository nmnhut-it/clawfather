@echo off
REM Runs PMD check or CPD analysis via the local tools\ installation
REM Usage: run-pmd.bat <check|cpd> <file_or_dir> [language]

setlocal enabledelayedexpansion

set "MODE=%~1"
set "TARGET=%~2"
set "LANGUAGE=%~3"
if "%LANGUAGE%"=="" set "LANGUAGE=java"

if "%MODE%"=="" goto usage
if "%TARGET%"=="" goto usage

REM Locate PMD binary
set "PMD_BIN="
for /d %%d in (tools\pmd-bin-*) do (
  if exist "%%d\bin\pmd.bat" set "PMD_BIN=%%d\bin\pmd.bat"
)

if not defined PMD_BIN (
  echo ERROR: PMD not found in tools\. Run: exec .\skills\zest\install-tools.bat >&2
  exit /b 1
)

if "%MODE%"=="check" (
  "%PMD_BIN%" check -d "%TARGET%" -R "rulesets/%LANGUAGE%/quickstart.xml" -f json
  exit /b !errorlevel!
)

if "%MODE%"=="cpd" (
  "%PMD_BIN%" cpd --minimum-tokens 50 -d "%TARGET%" --language "%LANGUAGE%"
  exit /b !errorlevel!
)

echo Error: mode must be 'check' or 'cpd' >&2
exit /b 1

:usage
echo Usage: run-pmd.bat ^<check^|cpd^> ^<file_or_dir^> [language]
exit /b 1
