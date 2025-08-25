@echo off
echo Starting Call Center AMI Listener...
echo =====================================

cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if required packages are installed
if not exist "node_modules" (
    echo Installing Node.js packages...
    npm install
)

REM Set environment variables if needed
if not exist ".env" (
    echo WARNING: .env file not found. Using default values.
)

REM Start the AMI listener
echo Starting AMI Listener Process...
echo Press Ctrl+C to stop
echo.

node ami-listener-process.js

echo.
echo AMI Listener stopped.
pause