@echo off
REM Opens a URL in the default browser (Windows)
if "%~1"=="" (
  echo Usage: open-url.bat ^<URL^>
  exit /b 1
)
start "" "%~1"
