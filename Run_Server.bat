@echo off
title YT Screenshot Extractor - Local Server
cd /d "d:\Claude Code\YT Screenshoot"
echo ============================================================
echo Starting FastAPI Backend and Cloudflare Tunnel...
echo ============================================================
python start_server.py
pause
