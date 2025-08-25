@echo off
echo Call Center Shajgoj API Testing
echo ===================================
echo.

set API_BASE=http://localhost:3000

echo 1. Testing API Information
curl -s %API_BASE%/
echo.
echo.

echo 2. Testing Health Check
curl -s %API_BASE%/health
echo.
echo.

echo 3. Testing Get All Users
curl -s "%API_BASE%/api/users?limit=5"
echo.
echo.

echo 4. Testing User Creation
curl -s -X POST %API_BASE%/api/users -H "Content-Type: application/json" -d "{\"name\": \"Test User Windows\", \"email\": \"test.windows@example.com\", \"extension\": \"9002\", \"role\": \"agent\", \"department\": \"Windows Testing\"}"
echo.
echo.

echo 5. Testing Search
curl -s "%API_BASE%/api/users?search=test"
echo.
echo.

echo 6. Testing Active Users
curl -s %API_BASE%/api/users/active
echo.
echo.

echo Testing Complete!
pause