# AMI Environment Variables Setup

## Required Environment Variables

The application now **requires** all AMI connection details to be set in environment variables. No default credentials are provided.

### Create `.env` file

Create a `.env` file in the `api/` directory with the following variables:

```bash
# Required AMI Connection Details
AMI_HOST=your_asterisk_server_ip
AMI_PORT=5038
AMI_USERNAME=your_ami_username
AMI_PASSWORD=your_ami_password

# Optional AMI Configuration
ENABLE_AMI_LISTENER=true
USE_HYBRID_AMI=true
ENABLE_AMI_QUERY_SERVICE=false
AMI_EVENTS=on

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/call_center

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Important Notes

1. **No Default Credentials**: The application will fail to start if any required AMI environment variables are missing
2. **Security**: Never commit your `.env` file to version control
3. **Validation**: The application validates all required variables before attempting to connect
4. **Error Messages**: Clear error messages will indicate which variables are missing

## Required Variables

- `AMI_HOST`: IP address or hostname of your Asterisk server
- `AMI_PORT`: AMI port (usually 5038)
- `AMI_USERNAME`: AMI username configured in Asterisk
- `AMI_PASSWORD`: AMI password configured in Asterisk

## Example Error

If you don't set the environment variables, you'll see:

```
Error: Missing required AMI environment variables. Please ensure AMI_HOST, AMI_PORT, AMI_USERNAME, and AMI_PASSWORD are set in your .env file.
```

## Testing

After setting up your `.env` file, restart the application:

```bash
npm run dev
```

The application should now connect to your Asterisk server using the credentials from the environment variables.
