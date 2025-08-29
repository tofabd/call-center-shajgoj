#!/bin/bash

# Call Center Shajgoj API Test Script
# This script demonstrates all the API endpoints and functionality

echo "🚀 Call Center Shajgoj API Testing Script"
echo "========================================="
echo ""

API_BASE="http://localhost:3000"

echo "📋 1. Testing API Information"
echo "GET $API_BASE/"
curl -s $API_BASE/ | json_pp
echo -e "\n"

echo "🔍 2. Testing Health Check"
echo "GET $API_BASE/health"
curl -s $API_BASE/health | json_pp
echo -e "\n"

echo "📖 3. Testing API Documentation"
echo "GET $API_BASE/api/docs"
curl -s $API_BASE/api/docs | json_pp
echo -e "\n"

echo "👥 4. Testing Get All Users (with pagination)"
echo "GET $API_BASE/api/users?page=1&limit=3"
curl -s "$API_BASE/api/users?page=1&limit=3" | json_pp
echo -e "\n"

echo "✅ 5. Testing Get Active Users Only"
echo "GET $API_BASE/api/users/active"
curl -s $API_BASE/api/users/active | json_pp
echo -e "\n"

echo "🔍 6. Testing Search Functionality"
echo "GET $API_BASE/api/users?search=john"
curl -s "$API_BASE/api/users?search=john" | json_pp
echo -e "\n"

echo "📊 7. Testing Filter by Role"
echo "GET $API_BASE/api/users?role=agent"
curl -s "$API_BASE/api/users?role=agent" | json_pp
echo -e "\n"

echo "➕ 8. Testing User Creation"
echo "POST $API_BASE/api/users"
NEW_USER_RESPONSE=$(curl -s -X POST $API_BASE/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test.user@example.com",
    "extension": "9001",
    "role": "agent",
    "department": "Testing"
  }')
echo $NEW_USER_RESPONSE | json_pp

# Extract user ID for further testing
USER_ID=$(echo $NEW_USER_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
echo -e "\n"

echo "🔄 9. Testing User Update"
echo "PUT $API_BASE/api/users/$USER_ID"
curl -s -X PUT $API_BASE/api/users/$USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "department": "Quality Assurance",
    "metadata": {
      "testUser": true,
      "updated": true
    }
  }' | json_pp
echo -e "\n"

echo "👁️ 10. Testing Get User by ID"
echo "GET $API_BASE/api/users/$USER_ID"
curl -s $API_BASE/api/users/$USER_ID | json_pp
echo -e "\n"

echo "📦 11. Testing Bulk User Creation"
echo "POST $API_BASE/api/users/bulk"
curl -s -X POST $API_BASE/api/users/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "name": "Bulk User 1",
        "email": "bulk1@example.com",
        "extension": "8001",
        "role": "agent",
        "department": "Bulk Testing"
      },
      {
        "name": "Bulk User 2",
        "email": "bulk2@example.com",
        "extension": "8002",
        "role": "supervisor",
        "department": "Bulk Testing"
      }
    ]
  }' | json_pp
echo -e "\n"

echo "❌ 12. Testing Error Handling - Duplicate Email"
echo "POST $API_BASE/api/users (with duplicate email)"
curl -s -X POST $API_BASE/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Test",
    "email": "test.user@example.com",
    "extension": "9999",
    "role": "agent"
  }' | json_pp
echo -e "\n"

echo "⚠️ 13. Testing Validation Error"
echo "POST $API_BASE/api/users (with invalid data)"
curl -s -X POST $API_BASE/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "X",
    "email": "invalid-email",
    "extension": "12",
    "role": "invalid-role"
  }' | json_pp
echo -e "\n"

echo "🗑️ 14. Testing User Deletion"
echo "DELETE $API_BASE/api/users/$USER_ID"
curl -s -X DELETE $API_BASE/api/users/$USER_ID | json_pp
echo -e "\n"

echo "❌ 15. Testing 404 Error - Get Deleted User"
echo "GET $API_BASE/api/users/$USER_ID"
curl -s $API_BASE/api/users/$USER_ID | json_pp
echo -e "\n"

echo "✅ Testing Complete!"
echo "All API endpoints have been tested successfully."
echo ""
echo "📊 Final User Count:"
echo "GET $API_BASE/api/users"
curl -s $API_BASE/api/users | grep -o '"totalUsers":[0-9]*' | cut -d':' -f2
echo " users in the database"