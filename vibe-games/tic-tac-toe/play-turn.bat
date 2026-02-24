@echo off
REM Play one AI turn of Tic Tac Toe.
REM Usage: play-turn.bat <p1|p2> [port]

set PLAYER=%1
if "%PLAYER%"=="" set PLAYER=p1
set PORT=%2
if "%PORT%"=="" set PORT=3001
set TTT_PORT=%PORT%

set SCRIPT_DIR=%~dp0
set GAME_DIR=%SCRIPT_DIR%..\..\vibe-games\tic-tac-toe

node "%GAME_DIR%\picoclaw-turn.js" %PLAYER%
