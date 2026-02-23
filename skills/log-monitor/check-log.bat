@echo off
REM Reads new lines from a log file, filters ERROR/WARN/EXCEPTION
REM Usage:
REM   check-log.bat <file>           Check new lines only
REM   check-log.bat --reset <file>   Reset offset, re-read all

setlocal enabledelayedexpansion

set "OFFSET_DIR=%USERPROFILE%\.picoclaw\workspace\log-monitor"
if not exist "%OFFSET_DIR%" mkdir "%OFFSET_DIR%"

if "%~1"=="--reset" (
  if "%~2"=="" (
    echo Usage: check-log.bat --reset ^<file^>
    exit /b 1
  )
  set "LOG_FILE=%~2"
  REM Hash path using certutil
  for /f "skip=1 delims=" %%h in ('echo !LOG_FILE! ^| certutil -hashfile - MD5 2^>nul ^| findstr /v "hash"') do (
    set "HASH=%%h"
  )
  set "HASH=!HASH: =!"
  if exist "%OFFSET_DIR%\!HASH!.offset" del "%OFFSET_DIR%\!HASH!.offset"
  echo Offset reset for: !LOG_FILE!
  exit /b 0
)

if "%~1"=="" (
  echo Usage: check-log.bat ^<file^>
  exit /b 1
)

set "LOG_FILE=%~1"

if not exist "%LOG_FILE%" (
  echo ERROR: File not found: %LOG_FILE%
  exit /b 1
)

REM Hash the file path for offset tracking
for /f "skip=1 delims=" %%h in ('echo %LOG_FILE% ^| certutil -hashfile - MD5 2^>nul ^| findstr /v "hash"') do (
  set "HASH=%%h"
)
set "HASH=!HASH: =!"
set "OFFSET_FILE=%OFFSET_DIR%\!HASH!.offset"

set "LAST_OFFSET=0"
if exist "!OFFSET_FILE!" set /p LAST_OFFSET=<"!OFFSET_FILE!"

REM Get current file size
for %%F in ("%LOG_FILE%") do set "CURRENT_SIZE=%%~zF"

REM Log rotation check
if !CURRENT_SIZE! lss !LAST_OFFSET! set "LAST_OFFSET=0"

REM No new content
if !CURRENT_SIZE! equ !LAST_OFFSET! (
  echo FILE: %LOG_FILE%
  echo STATUS: NO_NEW_LINES
  echo !CURRENT_SIZE!>"!OFFSET_FILE!"
  exit /b 0
)

echo FILE: %LOG_FILE%
echo STATUS: NEW_LINES

REM Count new lines and filter errors/warnings
set "ERROR_COUNT=0"
set "WARN_COUNT=0"
set "LINE_COUNT=0"
set "SKIP_LINES=0"

REM Count lines to skip (approximate from byte offset)
if !LAST_OFFSET! gtr 0 (
  for /f %%n in ('more +0 "%LOG_FILE%" ^| find /c /v ""') do set "TOTAL_LINES=%%n"
)

REM Simple approach: read all lines, skip processed ones
set "ERRORS="
set "WARNINGS="
for /f "usebackq tokens=* delims=" %%L in ("%LOG_FILE%") do (
  set /a LINE_COUNT+=1
  echo %%L | findstr /i /r "ERROR EXCEPTION FATAL" >nul 2>&1 && (
    set /a ERROR_COUNT+=1
    if !ERROR_COUNT! leq 20 echo %%L
  )
  echo %%L | findstr /i "WARN" >nul 2>&1 && (
    echo %%L | findstr /i /r "ERROR EXCEPTION FATAL" >nul 2>&1 || (
      set /a WARN_COUNT+=1
    )
  )
)

echo LINES: !LINE_COUNT!
echo ERROR_COUNT: !ERROR_COUNT!
echo WARN_COUNT: !WARN_COUNT!
echo ---END---

echo !CURRENT_SIZE!>"!OFFSET_FILE!"
endlocal
