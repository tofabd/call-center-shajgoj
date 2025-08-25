# Express API

A basic Hello World Express.js API server.

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Running the Server

### Production
```bash
npm start
```

### Development (with auto-restart)
```bash
npm run dev
```

## API Endpoints

- `GET /` - Returns a Hello World message
- `GET /health` - Health check endpoint

## Server Details

- **Port**: 3000 (configurable via PORT environment variable)
- **Framework**: Express.js v5.1.0
- **Features**: JSON parsing, URL encoding, basic routing

## Testing

Once the server is running, you can test the endpoints:

```bash
# Test the main endpoint
curl http://localhost:3000/

# Test the health endpoint
curl http://localhost:3000/health
```

The server will be available at `http://localhost:3000`
