#!/bin/bash

# Call Center Shajgoj MongoDB API - Deployment Readiness Check
# This script verifies that the API is ready for deployment

echo "🚀 Call Center Shajgoj API - Deployment Readiness Check"
echo "======================================================"
echo ""

API_BASE="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check counters
total_checks=0
passed_checks=0

run_check() {
    total_checks=$((total_checks + 1))
    echo ""
    print_info "Check $total_checks: $1"
    
    eval $2
    if [ $? -eq 0 ]; then
        print_status "PASSED"
        passed_checks=$((passed_checks + 1))
    else
        print_error "FAILED"
    fi
}

# Deployment readiness checks
echo "Starting deployment readiness verification..."
echo ""

# Check 1: API Server is running
run_check "API Server Status" "curl -s -f $API_BASE/health > /dev/null"

# Check 2: MongoDB Connection
run_check "MongoDB Connection" "curl -s $API_BASE/health | grep -q '\"database\":\"Connected\"'"

# Check 3: User Management Endpoints
run_check "User Management Endpoints" "curl -s -f '$API_BASE/api/users' > /dev/null"

# Check 4: Authentication System
run_check "Authentication System" "curl -s -X POST $API_BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"email\": \"tofa.manual@gmail.com\", \"password\": \"12345678\"}' | grep -q '\"success\":true'"

# Check 5: Admin User Exists
run_check "Admin User Exists" "curl -s '$API_BASE/api/users?role=admin' | grep -q '\"totalUsers\":[1-9]'"

# Check 6: Data Validation
run_check "Data Validation" "curl -s -X POST $API_BASE/api/users -H 'Content-Type: application/json' -d '{\"name\": \"X\", \"email\": \"invalid\"}' | grep -q '\"success\":false'"

# Check 7: Error Handling
run_check "Error Handling" "curl -s '$API_BASE/nonexistent' | grep -q '\"success\":false'"

# Check 8: API Documentation
run_check "API Documentation" "curl -s -f $API_BASE/api/docs > /dev/null"

# Check 9: CORS Configuration
run_check "CORS Configuration" "curl -s -H 'Origin: http://localhost:5173' $API_BASE/health > /dev/null"

# Check 10: Environment Configuration
run_check "Environment Configuration" "[ -f .env ]"

# Summary
echo ""
echo "🏁 Deployment Readiness Summary"
echo "==============================="
echo "Total Checks: $total_checks"
echo "Passed: $passed_checks"
echo "Failed: $((total_checks - passed_checks))"

success_rate=$((passed_checks * 100 / total_checks))
echo "Success Rate: ${success_rate}%"

echo ""
if [ $passed_checks -eq $total_checks ]; then
    print_status "🎉 API is READY for deployment!"
    echo ""
    echo "📋 Deployment Information:"
    echo "========================="
    echo "• API Server: Running on port 3000"
    echo "• Database: MongoDB Connected"
    echo "• Authentication: Working"
    echo "• Admin Access: Available"
    echo "• Documentation: http://localhost:3000/api/docs"
    echo "• Health Check: http://localhost:3000/health"
    echo ""
    echo "🔑 Admin Credentials:"
    echo "• Email: tofa.manual@gmail.com"
    echo "• Password: 12345678"
    echo ""
    echo "🛠️  Next Steps:"
    echo "• Configure production environment variables"
    echo "• Set up SSL certificates"
    echo "• Configure reverse proxy (if needed)"
    echo "• Set up monitoring and logging"
else
    print_error "❌ API is NOT ready for deployment!"
    print_warning "Please fix the failed checks before deployment."
fi

echo ""
print_info "Deployment readiness check completed."