# Call Center Shajgoj API

A Node.js Express API with MongoDB integration for managing call center users and operations.

## Features

- 🚀 RESTful API with Express.js
- 🍃 MongoDB integration with Mongoose
- 👥 Complete User CRUD operations
- 📄 Pagination and filtering
- 🔍 Search functionality
- ✅ Data validation
- 🛠️ Error handling middleware
- 🌐 CORS support
- 📊 Bulk operations
- 🔄 Real-time ready

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or MongoDB Atlas)
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB connection string:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/call_center_shajgoj
CORS_ORIGIN=http://localhost:5173
```

### 3. Start MongoDB

Make sure MongoDB is running:

```bash
# For local MongoDB installation
mongod

# Or if using MongoDB as a service
sudo systemctl start mongod
```

### 4. Seed Sample Data (Optional)

```bash
npm run seed
```

### 5. Start the Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Base URL
`http://localhost:3000`

### Documentation
- `GET /` - API information
- `GET /health` - Health check
- `GET /api/docs` - API documentation

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users with pagination |
| GET | `/api/users/active` | Get only active users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user |
| POST | `/api/users/bulk` | Bulk create users |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## User Model

```javascript
{
  "_id": "ObjectId",
  "name": "String (required, 2-50 chars)",
  "email": "String (required, unique, valid email)",
  "extension": "String (required, unique, 3-10 chars)",
  "role": "String (enum: 'agent', 'supervisor', 'admin', default: 'agent')",
  "department": "String (optional, max 30 chars)",
  "isActive": "Boolean (default: true)",
  "lastLogin": "Date (nullable)",
  "metadata": "Object (flexible additional data)",
  "createdAt": "Date (auto-generated)",
  "updatedAt": "Date (auto-generated)"
}
```

## API Usage Examples

### Create User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "extension": "1001",
    "role": "agent",
    "department": "Sales"
  }'
```

### Get Users with Filtering

```bash
# Get all users
curl http://localhost:3000/api/users

# Get users with pagination
curl "http://localhost:3000/api/users?page=1&limit=5"

# Search users
curl "http://localhost:3000/api/users?search=john"

# Filter by role
curl "http://localhost:3000/api/users?role=agent"

# Filter by department
curl "http://localhost:3000/api/users?department=sales"

# Get only active users
curl "http://localhost:3000/api/users?isActive=true"
```

### Update User

```bash
curl -X PUT http://localhost:3000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "department": "Support"
  }'
```

### Bulk Create Users

```bash
curl -X POST http://localhost:3000/api/users/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "name": "User 1",
        "email": "user1@example.com",
        "extension": "2001",
        "role": "agent"
      },
      {
        "name": "User 2",
        "email": "user2@example.com",
        "extension": "2002",
        "role": "supervisor"
      }
    ]
  }'
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ },
  "pagination": { /* pagination info (if applicable) */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ /* validation errors (if applicable) */ ]
}
```

## Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Filtering
- `role`: Filter by user role (agent, supervisor, admin)
- `department`: Filter by department (case-insensitive)
- `isActive`: Filter by active status (true/false)
- `search`: Search in name, email, and extension (case-insensitive)

## Error Handling

The API includes comprehensive error handling for:
- Validation errors
- Duplicate entries
- Invalid ObjectIds
- Database connection issues
- Not found resources

## Database Indexes

The following indexes are created for optimal performance:
- `email` (unique)
- `extension` (unique)
- `isActive`

## Development

### Project Structure

```
api/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   └── userController.js    # User business logic
├── middleware/
│   └── errorHandler.js      # Error handling middleware
├── models/
│   └── User.js             # User schema and model
├── routes/
│   └── userRoutes.js       # User route definitions
├── scripts/
│   └── seedUsers.js        # Database seeder
├── .env                    # Environment variables
├── .env.example           # Environment template
├── index.js               # Main application file
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run seed` - Seed database with sample data

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
