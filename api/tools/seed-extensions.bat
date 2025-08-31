@echo off
echo Seeding Extensions for Call Center
echo ===================================

cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if MongoDB is running (optional check)
echo Checking MongoDB connection...

REM Run the extension seeding script
echo Starting extension seeding process...
echo This will create extensions 1001-1020 (Support) and 2001-2020 (Sales)
echo.

npm run seed-extensions

echo.
echo Extension seeding completed!
echo You can now:
echo - Start the API server: npm start
echo - Start the Managed AMI Service: npm run managed-ami (alias: npm run ami-process)
echo - View extensions in the frontend Extension Management page
echo.
pause