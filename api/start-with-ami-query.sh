#!/bin/bash

echo "Starting Call Center API with AMI Query Service..."
echo

# Set environment variables to enable both services
export ENABLE_AMI_LISTENER=true
export ENABLE_AMI_QUERY_SERVICE=true

# Display configuration
echo "Configuration:"
echo "- AMI Listener: $ENABLE_AMI_LISTENER"
echo "- AMI Query Service: $ENABLE_AMI_QUERY_SERVICE"
echo "- Query Interval: 30 seconds"
echo

# Start the API server
echo "Starting server..."
node index.js