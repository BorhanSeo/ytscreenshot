@echo off
title YT Screenshot Extractor - Local Server
cd /d "%~dp0"
echo ============================================================
echo Installing required packages (if missing)...
echo ============================================================
pip install -r requirements.txt
echo ============================================================
echo Starting Local Backend Server...
echo ============================================================
python start_server.py
pause
