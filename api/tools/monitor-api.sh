#!/bin/bash

# Call Center Shajgoj MongoDB API - Continuous Monitoring Script
# This script continuously monitors the API health and performance

echo "🔄 Call Center Shajgoj API - Continuous Monitoring"
echo "================================================="
echo ""

API_BASE="http://localhost:3000"
MONITOR_INTERVAL=30  # seconds between checks
MAX_CHECKS=10        # number of checks to perform

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_monitor() {
    echo -e "${CYAN}🔍 $1${NC}"
}

# Monitoring variables
check_count=0
successful_checks=0
failed_checks=0

# Function to check API health
check_api_health() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    print_monitor "[$timestamp] Checking API health..."
    
    # Health check
    health_response=$(curl -s -w "%{http_code}" $API_BASE/health)
    health_status_code="${health_response: -3}"
    health_body="${health_response%???}"
    
    if [ "$health_status_code" = "200" ]; then
        # Extract uptime from response
        uptime=$(echo $health_body | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)
        print_status "API is healthy (Uptime: ${uptime}s)"
        
        # Additional checks
        user_count_response=$(curl -s "$API_BASE/api/users" | grep -o '"totalUsers":[0-9]*' | cut -d':' -f2)
        if [ ! -z "$user_count_response" ]; then
            print_info "Total users in database: $user_count_response"
        fi
        
        # Test a quick login
        login_test=$(curl -s -X POST $API_BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email": "tofa.manual@gmail.com", "password": "12345678"}' | grep -o '"success":true')
        if [ "$login_test" = '"success":true' ]; then
            print_status "Authentication is working"
        else
            print_warning "Authentication test failed"
        fi
        
        successful_checks=$((successful_checks + 1))
    else
        print_error "API health check failed (Status: $health_status_code)"
        failed_checks=$((failed_checks + 1))
    fi
    
    check_count=$((check_count + 1))
    echo ""
}

# Function to display monitoring stats
display_stats() {
    echo "📊 Monitoring Statistics:"
    echo "========================"
    echo "Total Checks: $check_count"
    echo "Successful: $successful_checks"
    echo "Failed: $failed_checks"
    echo "Success Rate: $((successful_checks * 100 / check_count))%"
    echo ""
}

# Main monitoring loop
print_info "Starting continuous monitoring..."
print_info "Interval: ${MONITOR_INTERVAL} seconds"
print_info "Max checks: ${MAX_CHECKS}"
print_info "Press Ctrl+C to stop monitoring"
echo ""

# Initial check
check_api_health

# Continuous monitoring loop
for i in $(seq 2 $MAX_CHECKS); do
    print_info "Waiting ${MONITOR_INTERVAL} seconds for next check..."
    sleep $MONITOR_INTERVAL
    
    check_api_health
    display_stats
done

# Final summary
echo "🏁 Monitoring Complete!"
echo "======================"
display_stats

if [ $failed_checks -eq 0 ]; then
    print_status "Perfect! No failures detected during monitoring period."
else
    print_warning "There were $failed_checks failures during monitoring."
fi

echo ""
print_info "MongoDB API monitoring session ended."