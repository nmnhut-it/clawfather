@echo off
REM Play one AI turn of Air Land Sea.
REM Usage: play-turn.bat <p1|p2> [port]

set PLAYER=%1
if "%PLAYER%"=="" set PLAYER=p1
set PORT=%2
if "%PORT%"=="" set PORT=3000
set ALS_PORT=%PORT%

set SCRIPT_DIR=%~dp0
set GAME_DIR=%SCRIPT_DIR%..\..\vibe-games\air-land-sea

node "%GAME_DIR%\picoclaw-turn.js" %PLAYER%
