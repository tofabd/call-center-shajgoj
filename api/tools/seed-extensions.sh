#!/bin/bash

echo "Seeding Extensions for Call Center"
echo "==================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi

echo "Node.js version: $(node --version)"

# Check if MongoDB is accessible (optional)
echo "Checking MongoDB connection..."

# Check if required packages are installed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js packages..."
    npm install
fi

# Run the extension seeding script
echo "Starting extension seeding process..."
echo "This will create extensions 1001-1020 (Support) and 2001-2020 (Sales)"
echo

npm run seed-extensions

echo
echo "Extension seeding completed!"
echo "You can now:"
echo "- Start the API server: npm start"
echo "- Start the AMI listener: npm run ami-process"
echo "- View extensions in the frontend Extension Management page"
echo