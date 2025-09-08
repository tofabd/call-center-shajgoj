#!/bin/bash

# Get current host IP
HOST_IP=$(ip route show default | awk '{print $3}')
WSL_IP=$(hostname -I | awk '{print $1}')

echo "Updating .env with current IPs..."
echo "Host IP: $HOST_IP"
echo "WSL IP: $WSL_IP"

# Update .env file
sed -i "s/^DB_HOST=.*/DB_HOST=$HOST_IP/" .env
sed -i "s/^REDIS_HOST=.*/REDIS_HOST=$HOST_IP/" .env
sed -i "s/^REVERB_HOST=.*/REVERB_HOST=\"$WSL_IP\"/" .env

echo "✅ Updated .env file"
echo "Remember to restart your Laravel server!"