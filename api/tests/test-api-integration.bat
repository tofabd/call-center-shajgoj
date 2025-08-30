@echo off
setlocal enabledelayedexpansion

REM Test MongoDB API Integration
REM This script tests the connection and endpoints of the MongoDB API

set API_BASE_URL=http://localhost:3000/api
set FRONTEND_URL=http://localhost:5173

echo 🔧 Testing MongoDB API Integration
echo ======================================
echo API Base URL: %API_BASE_URL%
echo Frontend URL: %FRONTEND_URL%
echo.

REM Test 1: API Health Check
echo 📡 Test 1: API Health Check
echo GET %API_BASE_URL%/
curl -s -f "%API_BASE_URL%/" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ API is responding
) else (
    echo ❌ API is not responding
    echo    Make sure the API server is running: npm run dev ^(in api folder^)
)
echo.

REM Test 2: Live Calls Endpoint
echo 📞 Test 2: Live Calls Endpoint
echo GET %API_BASE_URL%/calls/live
curl -s -w "%%{http_code}" "%API_BASE_URL%/calls/live" > temp_response.txt 2>nul
if exist temp_response.txt (
    for /f %%i in (temp_response.txt) do set HTTP_CODE=%%i
    if "!HTTP_CODE!" == "200" (
        echo ✅ Live calls endpoint working
        type temp_response.txt | findstr /C:"data" >nul && echo    Live calls data found
    ) else (
        echo ❌ Live calls endpoint failed ^(HTTP !HTTP_CODE!^)
    )
    del temp_response.txt >nul 2>&1
) else (
    echo ❌ Could not test live calls endpoint
)
echo.

REM Test 3: Call Statistics Endpoint
echo 📊 Test 3: Call Statistics Endpoint
echo GET %API_BASE_URL%/calls/statistics
curl -s -w "%%{http_code}" "%API_BASE_URL%/calls/statistics" > temp_stats.txt 2>nul
if exist temp_stats.txt (
    for /f %%i in (temp_stats.txt) do set HTTP_CODE=%%i
    if "!HTTP_CODE!" == "200" (
        echo ✅ Statistics endpoint working
    ) else (
        echo ❌ Statistics endpoint failed ^(HTTP !HTTP_CODE!^)
    )
    del temp_stats.txt >nul 2>&1
) else (
    echo ❌ Could not test statistics endpoint
)
echo.

REM Test 4: Paginated Calls Endpoint
echo 📋 Test 4: Paginated Calls Endpoint
echo GET %API_BASE_URL%/calls?page=1^&limit=5
curl -s -w "%%{http_code}" "%API_BASE_URL%/calls?page=1&limit=5" > temp_paginated.txt 2>nul
if exist temp_paginated.txt (
    for /f %%i in (temp_paginated.txt) do set HTTP_CODE=%%i
    if "!HTTP_CODE!" == "200" (
        echo ✅ Paginated calls endpoint working
    ) else (
        echo ❌ Paginated calls endpoint failed ^(HTTP !HTTP_CODE!^)
    )
    del temp_paginated.txt >nul 2>&1
) else (
    echo ❌ Could not test paginated calls endpoint
)
echo.

REM Test 5: CORS Configuration
echo 🌐 Test 5: CORS Configuration
echo OPTIONS %API_BASE_URL%/calls/live ^(from frontend origin^)
curl -s -I -X OPTIONS -H "Origin: %FRONTEND_URL%" -H "Access-Control-Request-Method: GET" "%API_BASE_URL%/calls/live" > temp_cors.txt 2>nul
if exist temp_cors.txt (
    findstr /C:"Access-Control-Allow-Origin" temp_cors.txt >nul
    if !errorlevel! equ 0 (
        echo ✅ CORS is properly configured
    ) else (
        echo ❌ CORS may not be properly configured
        echo    This could cause frontend connection issues
    )
    del temp_cors.txt >nul 2>&1
) else (
    echo ❌ Could not test CORS configuration
)
echo.

echo 🎯 Summary:
echo ==========
echo 1. Start the API server: cd api ^&^& npm run dev
echo 2. Start the frontend: cd frontend ^&^& npm run dev
echo 3. Open LiveCalls component in the frontend
echo 4. The component should automatically poll for real-time data
echo.
echo 📚 Key Integration Points:
echo - API Base URL: %API_BASE_URL%
echo - Live Calls Endpoint: %API_BASE_URL%/calls/live
echo - Polling Interval: 2 seconds ^(configurable^)
echo - CORS Origins: Multiple ports supported ^(5173, 5073, 5074, 5075^)
echo.
echo 🔧 If you see any ❌ errors above:
echo 1. Ensure the API server is running on port 3000
echo 2. Check MongoDB connection in API logs
echo 3. Verify CORS configuration in .env file
echo 4. Check network connectivity between frontend and API

pause