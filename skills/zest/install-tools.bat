@echo off
REM Installs PMD and Semgrep for code analysis
REM Usage: install-tools.bat

setlocal enabledelayedexpansion

set "TOOLS_DIR=tools"
set "PMD_VERSION=7.0.0"
set "PMD_DIR=%TOOLS_DIR%\pmd-bin-%PMD_VERSION%"

echo === Installing Code Analysis Tools ===
if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"

REM 1. Semgrep
echo.
echo [1/2] Installing Semgrep...
where semgrep >nul 2>nul
if !errorlevel!==0 (
  echo   Already installed.
) else (
  pip install semgrep
  if !errorlevel! neq 0 (
    python -m pip install semgrep
    if !errorlevel! neq 0 (
      echo   ERROR: pip not found. Install Python first. >&2
      exit /b 1
    )
  )
  echo   Semgrep installed.
)

REM 2. PMD
echo.
echo [2/2] Installing PMD %PMD_VERSION%...
if exist "%PMD_DIR%" (
  echo   Already installed at %PMD_DIR%
) else (
  set "PMD_URL=https://github.com/pmd/pmd/releases/download/pmd_releases%%2F%PMD_VERSION%/pmd-dist-%PMD_VERSION%-bin.zip"
  echo   Downloading...
  powershell -Command "Invoke-WebRequest -Uri '!PMD_URL!' -OutFile '%TOOLS_DIR%\pmd.zip'"
  echo   Extracting...
  powershell -Command "Expand-Archive -Path '%TOOLS_DIR%\pmd.zip' -DestinationPath '%TOOLS_DIR%' -Force"
  del "%TOOLS_DIR%\pmd.zip"
  echo   PMD installed at %PMD_DIR%
)

echo.
echo === Done ===
echo   PMD: %PMD_DIR%\bin\pmd.bat
