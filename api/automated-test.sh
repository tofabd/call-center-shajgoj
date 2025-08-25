#!/bin/bash

# Call Center Shajgoj MongoDB API - Automated Testing Script
# This script runs comprehensive tests on the MongoDB API

echo "🚀 Call Center Shajgoj MongoDB API - Automated Testing"
echo "====================================================="
echo ""

# Set API base URL
API_BASE="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test counter
test_count=0
passed_tests=0

run_test() {
    test_count=$((test_count + 1))
    echo ""
    print_info "Test $test_count: $1"
    echo "Command: $2"
    
    response=$(eval $2)
    status_code=$?
    
    if [ $status_code -eq 0 ]; then
        print_status "PASSED"
        passed_tests=$((passed_tests + 1))
        echo "Response: $response" | head -c 200
        if [ ${#response} -gt 200 ]; then
            echo "..."
        fi
    else
        print_error "FAILED"
        echo "Error: $response"
    fi
    echo ""
}

# Start testing
echo "Starting automated API tests..."
echo ""

# Test 1: Health Check
run_test "Health Check" "curl -s $API_BASE/health"

# Test 2: API Documentation
run_test "API Documentation" "curl -s $API_BASE/api/docs"

# Test 3: Get All Users
run_test "Get All Users" "curl -s '$API_BASE/api/users'"

# Test 4: Get Active Users
run_test "Get Active Users" "curl -s '$API_BASE/api/users/active'"

# Test 5: Search for Admin Users
run_test "Search Admin Users" "curl -s '$API_BASE/api/users?role=admin'"

# Test 6: Search for Tofa
run_test "Search for Tofa" "curl -s '$API_BASE/api/users?search=tofa'"

# Test 7: Login Test with Tofa (manual user)
run_test "Login Test (Manual Tofa)" "curl -s -X POST $API_BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"email\": \"tofa.manual@gmail.com\", \"password\": \"12345678\"}'"

# Test 8: Create New User
run_test "Create New User" "curl -s -X POST $API_BASE/api/users -H 'Content-Type: application/json' -d '{\"name\": \"Auto Test User\", \"email\": \"autotest@example.com\", \"extension\": \"8888\", \"password\": \"password123\", \"role\": \"agent\", \"department\": \"Automation\"}'"

# Test 9: Login with New User
run_test "Login with New User" "curl -s -X POST $API_BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"email\": \"autotest@example.com\", \"password\": \"password123\"}'"

# Test 10: Get Users with Pagination
run_test "Get Users with Pagination" "curl -s '$API_BASE/api/users?page=1&limit=3'"

# Test 11: Filter by Department
run_test "Filter by Department" "curl -s '$API_BASE/api/users?department=admin'"

# Test 12: Bulk User Creation
run_test "Bulk User Creation" "curl -s -X POST $API_BASE/api/users/bulk -H 'Content-Type: application/json' -d '{\"users\": [{\"name\": \"Bulk User 1\", \"email\": \"bulk1@auto.com\", \"extension\": \"7001\", \"password\": \"bulk123\", \"role\": \"agent\"}, {\"name\": \"Bulk User 2\", \"email\": \"bulk2@auto.com\", \"extension\": \"7002\", \"password\": \"bulk123\", \"role\": \"supervisor\"}]}'"

# Test 13: Error Handling - Duplicate Email
run_test "Error Handling - Duplicate Email" "curl -s -X POST $API_BASE/api/users -H 'Content-Type: application/json' -d '{\"name\": \"Duplicate Test\", \"email\": \"autotest@example.com\", \"extension\": \"9999\", \"password\": \"test123\", \"role\": \"agent\"}'"

# Test 14: Error Handling - Invalid Data
run_test "Error Handling - Invalid Data" "curl -s -X POST $API_BASE/api/users -H 'Content-Type: application/json' -d '{\"name\": \"X\", \"email\": \"invalid-email\", \"extension\": \"12\", \"password\": \"123\", \"role\": \"invalid-role\"}'"

# Test 15: Final User Count
run_test "Final User Count" "curl -s '$API_BASE/api/users' | grep -o '\"totalUsers\":[0-9]*'"

# Summary
echo ""
echo "🏁 Testing Complete!"
echo "==================="
echo "Total Tests: $test_count"
echo "Passed Tests: $passed_tests"
echo "Failed Tests: $((test_count - passed_tests))"

if [ $passed_tests -eq $test_count ]; then
    print_status "All tests passed! 🎉"
else
    print_warning "Some tests failed. Check the results above."
fi

echo ""
print_info "MongoDB API is ready for use!"
echo "Admin Login: tofa.manual@gmail.com / 12345678"
echo "API Documentation: $API_BASE/api/docs"
echo "Health Check: $API_BASE/health"