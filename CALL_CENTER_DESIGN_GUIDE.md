# Call Center Design Guide

This document outlines the design patterns, visual elements, and UI components used in the call center application for consistent styling across similar projects.

## Overall Design Philosophy

### Layout Structure
- **Dashboard Layout**: Clean grid-based layout with cards/panels using `space-y-6` and responsive grid columns
- **Call Console Layout**: 3-column layout (`flex gap-4 p-6`) for real-time monitoring
- **Responsive Design**: Mobile-first approach with `sm:`, `md:`, `lg:` breakpoints
- **Dark Mode Support**: Full dark/light theme switching with `dark:` variants

### Color Scheme

#### Primary Colors
- **Blue/Indigo**: Primary brand color, used for headers and main actions
- **Green/Emerald**: Success states, online status, incoming calls
- **Red/Rose**: Error states, offline status, failed calls
- **Yellow/Amber**: Warning states, unknown status
- **Purple/Violet**: Secondary accent for outgoing calls and statistics
- **Orange**: Custom ranges, warnings, and special states

#### Status Colors
- **Online/Connected**: `bg-green-500`, `text-green-600`, `border-green-300`
- **Offline/Disconnected**: `bg-red-500`, `text-red-600`, `border-red-300`
- **Unknown/Warning**: `bg-yellow-500`, `text-yellow-600`, `border-yellow-300`
- **In Progress**: `bg-blue-500`, `text-blue-600`, `border-blue-300`

## Advanced Design Patterns

### Time Range Selector Cards
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <button className={`
    p-6 rounded-xl transition-all duration-300 transform
    hover:shadow-lg hover:scale-105 hover:-translate-y-1
    ${isActive 
      ? 'bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-blue-200'
      : 'bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40'
    }
    ring-1 ring-blue-300 dark:ring-blue-600
  `}>
    {/* Icon and content */}
  </button>
</div>
```

#### Color-coded Time Range Options
- **Today**: Blue (`from-blue-50 to-blue-100` / `from-blue-600 to-blue-700`)
- **Weekly**: Green (`from-green-50 to-green-100` / `from-green-600 to-green-700`)
- **Monthly**: Purple (`from-purple-50 to-purple-100` / `from-purple-600 to-purple-700`)
- **Custom**: Orange (`from-orange-50 to-orange-100` / `from-orange-600 to-orange-700`)

### Dashboard Statistics Cards

#### Statistics Card Pattern
```tsx
<div className="bg-linear-to-r from-[color]-50 to-[accent]-50 dark:from-[color]-900/20 dark:to-[accent]-900/20 rounded-xl p-4 border border-[color]-200 dark:border-[color]-800">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-[color]-600 dark:text-[color]-400">Label</p>
      <p className="text-2xl font-bold text-[color]-900 dark:text-[color]-100">
        {formatNumber(value)}
      </p>
      <ComparisonIndicator />
      <p className="text-xs text-[color]-600 dark:text-[color]-400 mt-1">
        Percentage of total
      </p>
    </div>
    <Icon className="h-8 w-8 text-[color]-500 dark:text-[color]-400" />
  </div>
</div>
```

#### Statistics Color Scheme
- **Total Calls**: Blue to Indigo (`from-blue-50 to-indigo-50`)
- **Incoming**: Green to Emerald (`from-green-50 to-emerald-50`)
- **Outgoing**: Purple to Violet (`from-purple-50 to-violet-50`)
- **Answered**: Green to Emerald (`from-green-50 to-emerald-50`)
- **Missed**: Red to Rose (`from-red-50 to-rose-50`)
- **Average Duration**: Orange to Amber (`from-orange-50 to-amber-50`)

### Auto-refresh Controls

#### Control Bar Pattern
```tsx
<div className="flex items-center space-x-3">
  {/* Auto-refresh toggle */}
  <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
    isAutoRefreshEnabled
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
  }`}>
    {isAutoRefreshEnabled ? 'Auto ON' : 'Auto OFF'}
  </button>
  
  {/* Countdown display */}
  <div className={`px-2 py-1 rounded-lg w-28 text-center ${
    isUpdating
      ? 'bg-orange-100 dark:bg-orange-900/30'
      : countdown > 5
        ? 'bg-blue-100 dark:bg-blue-900/30'
        : 'bg-orange-100 dark:bg-orange-900/30'
  }`}>
    <span className="text-xs font-medium">
      {isUpdating ? 'Updating...' : `Update in ${countdown}s`}
    </span>
  </div>
</div>
```

## Component Design Patterns

### Card Components

#### Basic Card Structure
```tsx
<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
  {/* Header */}
  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-[color]-50 to-[accent]-50 dark:from-gray-800 dark:to-gray-700 shrink-0">
    {/* Header content */}
  </div>
  
  {/* Content */}
  <div className="flex-1 overflow-hidden flex flex-col">
    <div className="flex-1 overflow-y-auto narrow-scrollbar">
      {/* Scrollable content */}
    </div>
  </div>
</div>
```

#### Header Color Schemes by Component
- **Live Calls**: `from-green-50 to-emerald-50` (green theme)
- **Call History**: `from-blue-50 to-indigo-50` (blue theme)  
- **Extensions**: `from-indigo-50 to-purple-50` (indigo-purple theme)
- **Statistics**: Dynamic based on time range (blue/green/purple/orange)

#### Header Design Pattern
```tsx
<div className="flex items-center space-x-3">
  <div className="p-2 bg-[color]-600 rounded-lg">
    <Icon className="h-5 w-5 text-white" />
  </div>
  <div className="flex-1">
    <div className="flex items-center space-x-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Title</h3>
      <StatusIndicator />
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400">Subtitle</p>
  </div>
  <Actions />
</div>
```

### Gradient Background System

#### Linear Gradient Patterns
The app uses a sophisticated gradient system for visual hierarchy:

**Light Mode Gradients:**
- Normal state: `bg-linear-to-r from-[color]-50 to-[accent]-50`
- Hover state: `hover:from-[color]-100 hover:to-[accent]-100`
- Active state: `bg-linear-to-br from-[color]-600 to-[color]-700`

**Dark Mode Gradients:**
- Normal state: `dark:from-[color]-900/20 dark:to-[accent]-900/20`
- Hover state: `dark:hover:from-[color]-900/30 dark:hover:to-[accent]-900/30`
- Header gradients: `dark:from-gray-800 dark:to-gray-700`

#### Extension Circle Gradients
```tsx
<div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
  status === 'online'
    ? isOnCall
      ? 'bg-linear-to-br from-emerald-500 to-green-700 dark:from-emerald-700 dark:to-green-900 shadow-emerald-300/70'
      : 'bg-linear-to-br from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-green-800 shadow-emerald-200/50'
    : status === 'offline'
    ? 'bg-linear-to-br from-red-400 to-rose-500 shadow-red-200/50'
    : 'bg-linear-to-br from-gray-400 to-slate-500 shadow-gray-200/50'
}`}>
```

### Status Indicators

#### Real-time Connection Status
```tsx
<StatusTooltip status={realtimeStatus} health={connectionHealth}>
  <span className="relative flex size-3 cursor-help group">
    {/* Ping animation for good connection */}
    {realtimeStatus === 'connected' && connectionHealth === 'good' && (
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
    )}
    <span className={`relative inline-flex size-3 rounded-full transition-all duration-200 ${statusColors}`}></span>
  </span>
</StatusTooltip>
```

#### Status Colors for Connection
- **Connected + Good**: `bg-green-500` with ping animation
- **Connected + Poor**: `bg-yellow-500`
- **Connected + Stale**: `bg-orange-500`
- **Reconnecting**: `bg-blue-500`
- **Disconnected**: `bg-red-500`
- **Checking**: `bg-gray-500`

#### Comparison Indicators (Trends)
```tsx
const ComparisonIndicator: React.FC<{ value: number; isPercentage?: boolean }> = ({ value, isPercentage = false }) => {
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  
  return (
    <div className={`flex items-center space-x-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">
        {isPositive ? '+' : ''}{isPercentage ? `${value}%` : formatNumber(value)}
      </span>
    </div>
  );
};
```

### Interactive Elements

#### Refresh Button Pattern
```tsx
<button
  onClick={handleRefresh}
  className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
    isRefreshing
      ? 'bg-blue-100 dark:bg-blue-900/30' 
      : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
  }`}
  disabled={isRefreshing}
>
  <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
    isRefreshing
      ? 'text-blue-600 dark:text-blue-400 animate-spin'
      : 'text-gray-600 dark:text-gray-400 group-hover:text-[accent]-600 group-hover:scale-110'
  }`} />
</button>
```

#### Countdown Timer Display
```tsx
<div className="flex items-center px-2 py-1 rounded-lg text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 min-w-[60px] justify-center">
  {!isRefreshing && <span className="mr-1">⏰</span>}
  {isRefreshing ? 'Updating...' : `${countdown}s`}
</div>
```

### List Items and Cards

#### Call/Extension Item Structure
```tsx
<div
  className={`group p-4 border rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer min-h-[80px] flex flex-col justify-center ${backgroundColorBasedOnStatus}`}
  onClick={onItemClick}
>
  {/* Main info line */}
  <div className="flex items-center space-x-3">
    <DirectionIcon />
    <MainContent />
    <StatusBadges />
  </div>
  
  {/* Secondary info line */}
  <div className="mt-2 ml-7 flex items-center space-x-3">
    <TimeInfo />
    <DurationInfo />
  </div>
</div>
```

#### Background Colors by Status and Direction
**Incoming Calls:**
- **Active/Ringing**: `bg-linear-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-green-300 dark:border-green-700`
- **Hover**: `hover:from-green-100 hover:to-teal-100 dark:hover:from-green-900/30 dark:hover:to-teal-900/30`

**Outgoing Calls:**
- **Active/Ringing**: `bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-300 dark:border-indigo-700`
- **Hover**: `hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30`

**Failed/Busy Calls:**
- **Incoming**: `bg-linear-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20`
- **Outgoing**: `bg-linear-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20`

**Missed/No Answer:**
- **Incoming**: `bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20`
- **Outgoing**: `bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20`

#### Special Effects
- **Ringing Calls**: Add `border-l-4 border-l-[color]-500` and `animate-pulse ring-2 ring-[color]-400`
- **Online Extensions**: Add `ring-1 ring-green-200 dark:ring-green-800/30` for subtle glow
- **Extension On Call**: Outer ping effect with `animate-ping opacity-60 dark:opacity-80`

### Status Badges

#### Standard Badge Pattern
```tsx
<span className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-full min-w-[80px] justify-center ${statusColors}`}>
  {statusIcon && <StatusIcon />}
  <span className="ml-2">{statusText}</span>
</span>
```

#### Animated Badges (Ringing)
```tsx
<span className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-full animate-pulse ring-2 ring-[color]-400 shadow-lg shadow-[color]-200 dark:shadow-[color]-900 bg-[color]-600 text-white dark:bg-[color]-500 font-bold ringing-badge`}>
  <RingingIcon />
  <span className="ml-1 font-bold">{statusText}</span>
</span>
```

#### Ringing Icon Animation
```tsx
const RingingIcon: React.FC = () => {
  const [isPhoneCall, setIsPhoneCall] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsPhoneCall(prev => !prev);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center justify-center ml-1 mr-1 ringing-icon">
      {isPhoneCall ? (
        <PhoneCall className="h-4 w-4 text-white drop-shadow-sm filter" />
      ) : (
        <Phone className="h-4 w-4 text-white drop-shadow-sm filter" />
      )}
    </span>
  );
};
```

### Extension Display

#### Extension Circle Design
```tsx
<div className="shrink-0 relative">
  <div className={`w-12 h-12 rounded-full flex items-center justify-center p-1 transition-all duration-300 group-hover:scale-110 shadow-md ${gradientAndShadowBasedOnStatus}`}>
    <span className="text-white font-bold text-sm drop-shadow-md">
      {extensionNumber}
    </span>
  </div>

  {/* Pulse effect for extensions on call */}
  {isOnCall && (
    <div className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-emerald-800 animate-ping opacity-60 dark:opacity-80"></div>
  )}
</div>
```

#### Extension Status Background Logic
```tsx
const getExtensionBackground = (status: string, isOnCall: boolean) => {
  if (status === 'online') {
    return isOnCall
      ? 'bg-linear-to-br from-emerald-500 to-green-700 dark:from-emerald-700 dark:to-green-900 shadow-emerald-300/70'
      : 'bg-linear-to-br from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-green-800 shadow-emerald-200/50';
  } else if (status === 'offline') {
    return 'bg-linear-to-br from-red-400 to-rose-500 shadow-red-200/50';
  } else if (status === 'unknown') {
    return 'bg-linear-to-br from-yellow-400 to-amber-500 shadow-yellow-200/50';
  }
  return 'bg-linear-to-br from-gray-400 to-slate-500 shadow-gray-200/50';
};
```

### Brand Elements

#### Logo and Brand Colors
```tsx
{/* Brand gradient used in logos, headers, login */}
<div className="w-8 h-8 bg-linear-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
  <Icon className="h-5 w-5 text-white" />
</div>

{/* Text gradients for branding */}
<h1 className="text-3xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
  Call Center
</h1>

{/* Button gradients */}
<button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40">
```

#### Page Background Patterns
```tsx
{/* Login page background */}
<div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-blue-900 dark:to-gray-800">

{/* Main app background */}
<div className="bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)]">
```

### Modal and Dialog Patterns

#### Modal Header
```tsx
<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-[theme]-50 to-[accent]-50 dark:from-[theme]-900/20 dark:to-[accent]-900/20">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Title</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Subtitle</p>
      </div>
    </div>
    <CloseButton />
  </div>
</div>
```

#### Call Details Card Pattern
```tsx
<div className="relative rounded-2xl border border-blue-200 dark:border-blue-800 bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 p-6 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20 mb-8 overflow-hidden">
  {/* Card content with call information */}
</div>
```

### Data Visualization Patterns

#### Chart Container Pattern
```tsx
<div className="bg-linear-to-br from-[color]-50 to-[accent]-50 dark:from-[color]-900/20 dark:to-[accent]-900/20 rounded-xl border border-[color]-200 dark:border-[color]-700 p-4">
  {/* Chart content */}
</div>
```

Examples:
- **Incoming Analysis**: `from-green-50 to-emerald-50` with `border-green-200`
- **Outgoing Analysis**: `from-purple-50 to-violet-50` with `border-purple-200`

### Animation Patterns

#### Loading States
```tsx
{/* Spinner */}
<div className="w-8 h-8 border-4 border-[color]-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>

{/* Skeleton Loading */}
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
</div>

{/* Button Loading State */}
<RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
```

#### Hover and Transform Effects
```tsx
{/* Card hover lift */}
<div className="transform hover:scale-105 hover:-translate-y-1 transition-all duration-300">

{/* Icon scale on hover */}
<Icon className="group-hover:scale-110 transition-all duration-200" />

{/* Shadow transitions */}
<div className="hover:shadow-lg transition-shadow duration-200">
```

#### Status-based Animations
- **Ringing**: `animate-pulse` with ring effects and color changes
- **Connection Good**: `animate-ping` on status indicator
- **Extension On Call**: `animate-ping` with emerald colors
- **Auto-update**: Spinner with contextual colors (orange for auto, blue for manual)

### Typography and Content Patterns

#### Font Usage
```tsx
{/* Headers */}
<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
<h3 className="text-xl font-semibold text-gray-900 dark:text-white">

{/* Phone numbers and technical data */}
<span className="text-base font-bold text-gray-900 dark:text-gray-100 font-mono">
<span className="font-mono font-bold">

{/* Status and labels */}
<span className="text-xs font-medium">
<span className="text-sm font-medium">

{/* Timestamps and durations */}
<span className="text-xs text-gray-500 dark:text-gray-400">
<p className="text-xs font-mono bg-gray-100 dark:bg-gray-700">
```

#### Content Spacing
```tsx
{/* Card sections */}
<div className="space-y-6">  {/* Dashboard layout */}
<div className="space-y-8">  {/* Statistics sections */}
<div className="space-y-3">  {/* List items */}
<div className="space-x-3">  {/* Horizontal elements */}

{/* Item spacing */}
<div className="p-4">        {/* List item padding */}
<div className="px-6 py-5">  {/* Card header padding */}
<div className="p-6">        {/* Card content padding */}
```

### Responsive Design Patterns

#### Grid Systems
```tsx
{/* Time range selector */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

{/* Statistics cards */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

{/* Dashboard layout */}
<div className="w-full p-4 lg:p-6 space-y-6">

{/* Call console 3-column */}
<div className="flex gap-4 p-6 h-full overflow-hidden">
  <div className="flex-1 min-w-0">  {/* Each column */}
```

#### Responsive Utilities
```tsx
{/* Responsive padding */}
className="p-4 lg:p-6"

{/* Responsive text */}
className="text-base lg:text-lg"

{/* Responsive grid columns */}
className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"

{/* Responsive spacing */}
className="space-y-4 lg:space-y-6"
```

### Error and Empty States

#### Error State Pattern
```tsx
<div className="flex items-center justify-center flex-1 p-6">
  <div className="text-center">
    <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
      <Icon className="h-8 w-8 text-red-600 dark:text-red-400" />
    </div>
    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
    <button className="mt-3 px-4 py-2 bg-[accent]-600 text-white rounded-lg hover:bg-[accent]-700 transition-colors">
      Retry
    </button>
  </div>
</div>
```

#### Empty State Pattern
```tsx
<div className="flex items-center justify-center flex-1 p-6">
  <div className="text-center">
    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
      <Icon className="h-10 w-10 text-gray-400" />
    </div>
    <h4 className="text-gray-900 dark:text-white font-medium mb-1">No Data</h4>
    <p className="text-gray-500 dark:text-gray-400 text-sm">Descriptive message about empty state</p>
  </div>
</div>
```

## Implementation Guidelines

### Custom CSS Classes
```css
/* Custom scrollbar */
.narrow-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(156 163 175) transparent;
}

/* Animation keyframes */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 2s linear infinite !important;
}
```

### Consistency Rules

1. **Always use `rounded-xl` for cards and major elements, `rounded-lg` for smaller components**
2. **Maintain `transition-all duration-200` for interactive elements**
3. **Use `min-h-[80px]` for list items to ensure consistent height**
4. **Apply `shrink-0` to icons and fixed-width elements**
5. **Use `flex-1 min-w-0` for flexible content areas**
6. **Add `overflow-hidden` to cards with scroll areas**
7. **Always include dark mode variants with `dark:` prefix**
8. **Use semantic color combinations (green for success, red for errors, blue for info)**

This comprehensive design system ensures consistent visual language across all call center application components and can be easily adapted for similar monitoring or dashboard applications.