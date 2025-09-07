# Call Center Management System

A comprehensive call center management system built with Laravel (backend) and React (frontend) that integrates with Asterisk PBX for real-time call monitoring and management.

## Overview

This comprehensive call center management system provides end-to-end solutions for modern call center operations, built with Laravel backend and React frontend. The system excels in real-time call monitoring, extension status management, detailed call analytics, and seamless Asterisk PBX integration.

### Key Capabilities

**Real-Time Call Monitoring & Management:**
- Live tracking of all active calls with automatic status derivation (ringing, answered, in_progress, completed, busy, no_answer, etc.)
- Detailed call flow analysis including call legs, bridge segments, and routing steps
- Extension change tracking during call transfers and handoffs
- Call recording file integration and metadata management

**Extension & Agent Management:**
- Real-time extension status monitoring with automatic updates from Asterisk AMI
- Agent availability tracking with status mapping (online, offline, invalid, unknown)
- Team-based organization of extensions and agents
- Status duration tracking and offline/online time calculations
- Bulk extension refresh and synchronization capabilities

**Advanced Analytics & Reporting:**
- Comprehensive statistics by time periods (today, week, month, custom ranges)
- Call direction analysis (incoming vs outgoing) with status breakdowns
- Visual charts and pie charts for call distribution and trends
- Hourly call volume analysis and performance metrics
- Agent-specific statistics and team performance tracking

**Real-Time Communication Infrastructure:**
- WebSocket-based real-time updates using Laravel Echo and Reverb
- Automatic data refresh on page visibility changes
- Configurable auto-refresh intervals for optimal performance
- Event-driven architecture for instant status updates

**User Interface & Experience:**
- Three-panel Call Console layout: Call History, Live Calls, and Extensions Status
- Interactive Dashboard with time period selection and visual analytics
- Detailed call modal with complete call flow visualization
- Responsive design with dark/light theme support
- Manual and automatic data refresh controls

## Architecture

### Backend (Laravel)
- **Framework**: Laravel 12.28.1
- **PHP**: ^8.2
- **Database**: MySQL with Eloquent ORM
- **Real-time**: Laravel Broadcasting with Redis
- **Authentication**: Laravel Sanctum
- **WebSockets**: Laravel Reverb ^1.0
- **PBX Integration**: Asterisk AMI

### Frontend (React)
- **Framework**: React 19.1.1 with TypeScript
- **Node.js**: v22.16.0
- **npm**: 10.9.2
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS v4.1.12
- **State Management**: React hooks and context
- **Real-time**: Laravel Echo with WebSockets
- **Routing**: React Router v7.8.2
- **UI Components**: Radix UI, Lucide React icons

## Core Features

### 📞 Call Management
- **Real-time Call Monitoring**: Live tracking of all active calls
- **Call History**: Complete call logs with detailed information
- **Call Details**: In-depth analysis of individual calls including:
  - Call flow and routing steps
  - Extension changes and transfers
  - Call legs and bridge segments
  - Recording file information
- **Call Status Tracking**: Automatic status derivation (ringing, answered, completed, busy, no answer, etc.)

### 👥 Extension Management
- **Real-time Extension Status**: Live monitoring of all extensions
- **Agent Assignment**: Link extensions to agents and teams
- **Status Updates**: Automatic status updates from Asterisk AMI
- **Extension Statistics**: Performance metrics per extension
- **Team Organization**: Group extensions by teams/departments

### 📊 Analytics & Reporting
- **Dashboard Statistics**: Real-time metrics and KPIs
- **Call Statistics**: Comprehensive reporting by:
  - Time periods (today, week, month, custom range)
  - Call direction (incoming/outgoing)
  - Call status and disposition
  - Agent performance
- **Visual Charts**: Pie charts and trend analysis
- **Hourly Trends**: Call volume analysis by hour

### 🎯 Real-time Features
- **Live Call Updates**: Real-time call status changes
- **Extension Status Updates**: Instant extension availability changes
- **WebSocket Integration**: Laravel Echo for real-time notifications
- **Auto-refresh**: Configurable automatic data refresh
- **Page Visibility**: Smart refresh when returning to the application

### 🛠️ Administration
- **User Management**: Authentication and authorization
- **Team Management**: Create and manage agent teams
- **Extension CRUD**: Full lifecycle management of extensions
- **Settings**: System configuration and preferences

## Data Models

### Core Entities
- **Calls**: Main call records with linkedid, direction, parties, timestamps
- **Call Legs**: Individual call segments with channel information
- **Bridge Segments**: Agent participation in call bridges
- **Extensions**: Phone extensions with status and agent assignment
- **Teams**: Organizational groups for extensions
- **Users**: System users with authentication

### Key Relationships
- Calls have many Call Legs and Bridge Segments
- Extensions belong to Teams
- Users have associated Extensions
- Extensions track status changes and durations

## Integration Features

### Asterisk PBX Integration
- **AMI Connection**: Direct connection to Asterisk Manager Interface
- **Extension Status Sync**: Real-time extension status updates
- **Call Event Processing**: Automatic call event handling
- **Queue Integration**: Support for Asterisk queues
- **Trunk Monitoring**: External trunk call tracking

### Real-time Communication
- **WebSocket Events**: Laravel Broadcasting for real-time updates
- **Echo Channels**: Dedicated channels for calls and extensions
- **Event Broadcasting**: Automatic event broadcasting on data changes
- **Client-side Updates**: React components update in real-time

## User Interface

### Dashboard
- **Time Period Selection**: Today, This Week, This Month, Custom Range
- **Statistics Cards**: Key metrics with visual indicators
- **Charts**: Call direction and status distribution
- **Trend Analysis**: Performance over time

### Call Console
- **Three-Panel Layout**:
  - **Call History**: Completed calls with filtering and search
  - **Live Calls**: Active calls with real-time updates
  - **Extensions Status**: Agent availability and status
- **Call Details Modal**: Comprehensive call information
- **Manual Refresh**: User-triggered data updates
- **Auto-refresh**: Configurable automatic refresh intervals

### Settings
- **System Configuration**: Application settings
- **User Preferences**: Personalization options
- **Integration Settings**: PBX connection configuration

## Technical Features

### Performance Optimizations
- **Database Indexing**: Optimized queries for large datasets
- **Caching**: Redis caching for frequently accessed data
- **Lazy Loading**: Efficient data loading and pagination
- **Background Jobs**: Queue processing for heavy operations

### Security
- **Authentication**: Secure login with Laravel Sanctum
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive data validation
- **CSRF Protection**: Cross-site request forgery prevention

### Monitoring & Logging
- **Application Logs**: Detailed logging for debugging
- **Performance Monitoring**: Query performance tracking
- **Error Handling**: Comprehensive error management
- **Debug Files**: AMI response logging for troubleshooting

## Technology Stack & Versions

### Backend Versions
- **Laravel Framework**: 12.28.1
- **PHP**: ^8.2
- **Laravel Reverb**: ^1.0 (WebSockets)
- **Laravel Sanctum**: ^4.1 (Authentication)
- **Pest**: ^3.8 (Testing)
- **Predis**: ^3.2 (Redis client)

### Frontend Versions
- **React**: 19.1.1
- **React DOM**: 19.1.1
- **TypeScript**: ~5.8.3
- **Vite**: ^6.3.5
- **Tailwind CSS**: ^4.1.12
- **React Router**: ^7.8.2
- **Laravel Echo**: ^2.1.4
- **Socket.io-client**: ^4.7.5

### Development Environment
- **Node.js**: v22.16.0
- **npm**: 10.9.2

## Installation & Setup

### Prerequisites
- PHP ^8.2
- Node.js v22.16.0+
- npm 10.9.2+
- MySQL 8.0+
- Redis
- Asterisk PBX (optional, for full functionality)

### Backend Setup
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run build
```

### Configuration
- Configure Asterisk AMI credentials in `.env`
- Set up Redis connection for caching and broadcasting
- Configure database connection settings

## Usage

### Starting the Application
```bash
# Backend
php artisan serve

# Frontend (development)
npm run dev

# Frontend (production)
npm run build
npm run preview
```

### Key Workflows
1. **Monitor Live Calls**: View active calls in real-time
2. **Track Extension Status**: See agent availability instantly
3. **Review Call History**: Analyze completed calls with details
4. **Generate Reports**: View statistics and performance metrics
5. **Manage Extensions**: Add, update, and organize extensions

## API Endpoints

### Calls
- `GET /api/calls` - List all calls
- `GET /api/calls/live` - Get live/active calls
- `GET /api/calls/{id}/details` - Get detailed call information
- `GET /api/calls/today-stats` - Today's call statistics

### Extensions
- `GET /api/extensions` - List all extensions
- `POST /api/extensions` - Create new extension
- `PUT /api/extensions/{id}` - Update extension
- `DELETE /api/extensions/{id}` - Delete extension
- `POST /api/extensions/refresh` - Refresh from Asterisk AMI

### Teams
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create new team
- `PUT /api/teams/{id}` - Update team
- `DELETE /api/teams/{id}` - Delete team

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
