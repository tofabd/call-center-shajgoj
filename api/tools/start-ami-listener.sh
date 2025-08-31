#!/bin/bash

echo "Starting Call Center Managed AMI Service..."
echo "====================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi

echo "Node.js version: $(node --version)"

# Check if required packages are installed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js packages..."
    npm install
fi

# Check environment file
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found. Using default values."
fi

# Start the managed AMI service
echo "Starting Managed AMI Service process..."
echo "Press Ctrl+C to stop"
echo

# Use node directly for production, or nodemon for development
if [ "$1" = "dev" ]; then
    echo "Starting in development mode with auto-restart..."
    if command -v nodemon &> /dev/null; then
        nodemon ami-listener-process.js
    else
        echo "Installing nodemon for development..."
        npm install -g nodemon
        nodemon ami-listener-process.js
    fi
else
    node ami-listener-process.js
fi

echo
echo "Managed AMI Service stopped."