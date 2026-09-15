@echo off
REM VitaGraph one-click development launcher (Windows).
REM Starts the FastAPI backend on :8000 and the Vite frontend on :5173.

setlocal
cd /d "%~dp0"

echo === VitaGraph development launcher ===

REM --- Backend ---------------------------------------------------------------
start "VitaGraph backend" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

REM --- Frontend --------------------------------------------------------------
start "VitaGraph frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo.
echo Two windows opened. Close them to stop the servers.
endlocal
