import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Extend window type for global variables
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: any; // Simplified to avoid generic type complexity
  }
}

// Make Pusher available globally
window.Pusher = Pusher;

// Initialize Echo with support for multiple broadcasters
let echo: any = null;

// Try Pusher first (production)
const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;
const pusherCluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;

// Fallback to Reverb (local development)
const reverbKey = import.meta.env.VITE_REVERB_APP_KEY;
const reverbHost = import.meta.env.VITE_REVERB_HOST;

if (pusherKey && pusherCluster) {
  try {
    echo = new Echo({
      broadcaster: 'pusher',
      key: pusherKey,
      cluster: pusherCluster,
      forceTLS: true,
    });

    window.Echo = echo;
    console.log('✅ Echo initialized successfully with Pusher');
  } catch (error) {
    console.error('❌ Failed to initialize Echo with Pusher:', error);
  }
}

// If Pusher failed or not configured, try Reverb
if (!echo && reverbKey && reverbHost) {
  try {
    echo = new Echo({
      broadcaster: 'reverb',
      key: reverbKey,
      wsHost: reverbHost, // Use configured host instead of window.location.hostname
      wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
      wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
    });

    window.Echo = echo;
    console.log('✅ Echo initialized successfully with Reverb');
  } catch (error) {
    console.error('❌ Failed to initialize Echo with Reverb:', error);
  }
}

// If both failed, create mock Echo
if (!echo) {
  console.warn('⚠️ Echo not initialized - missing broadcast configuration');
  console.warn('Real-time features will be disabled. Please check your .env file.');
  
  window.Echo = {
    channel: () => ({
      listen: () => console.warn('Echo not configured - add broadcast configuration to .env file')
    }),
    leaveChannel: () => {}
  };
}

export default echo; 