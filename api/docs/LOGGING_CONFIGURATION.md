# Quick Logging Configuration Guide

## Environment Variables

Add these to your `.env` file:

```bash
# Logging Configuration
NODE_ENV=development
LOG_LEVEL=info
```

## Quick Start Examples

### Development (Pretty Logs)
```bash
NODE_ENV=development LOG_LEVEL=info npm run dev
```

### Production (JSON Logs)
```bash
NODE_ENV=production LOG_LEVEL=info npm start
```

### Debug Mode
```bash
NODE_ENV=development LOG_LEVEL=debug npm run dev
```

### Test Mode (Minimal Logs)
```bash
NODE_ENV=test npm test
```

## Log Level Reference

| Level | Use Case | Example |
|-------|----------|---------|
| `error` | Production errors | `LOG_LEVEL=error` |
| `warn` | Warnings only | `LOG_LEVEL=warn` |
| `info` | Normal operation | `LOG_LEVEL=info` (default) |
| `debug` | Development debugging | `LOG_LEVEL=debug` |
| `trace` | Detailed tracing | `LOG_LEVEL=trace` |

## What You'll See

### Development Mode (`NODE_ENV=development`)
```
[12:34:56.789] INFO: Server started successfully
    port: 3000
    endpoints: {
      api: "http://localhost:3000"
      health: "http://localhost:3000/health"
    }
```

### Production Mode (`NODE_ENV=production`)
```json
{
  "level": 30,
  "time": "2024-01-15T12:34:56.789Z",
  "msg": "Server started successfully",
  "port": 3000,
  "endpoints": {
    "api": "http://localhost:3000",
    "health": "http://localhost:3000/health"
  }
}
```
