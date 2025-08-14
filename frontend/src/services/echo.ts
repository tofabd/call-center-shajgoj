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

// Initialize Echo only if required environment variables are present
let echo: any = null;

const reverbKey = import.meta.env.VITE_REVERB_APP_KEY;
const reverbHost = import.meta.env.VITE_REVERB_HOST;

if (reverbKey && reverbHost) {
  try {
    echo = new Echo({
      broadcaster: 'reverb',
      key: reverbKey,
      wsHost: reverbHost,
      wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
      wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
    });

    // Make Echo available globally
    window.Echo = echo;
    
    console.log('✅ Echo initialized successfully with Reverb');
  } catch (error) {
    console.error('❌ Failed to initialize Echo:', error);
    
    // Create a mock Echo object to prevent errors
    window.Echo = {
      channel: () => ({
        listen: () => console.warn('Echo not properly configured - real-time features disabled')
      }),
      leaveChannel: () => {}
    };
  }
} else {
  console.warn('⚠️ Echo not initialized - missing VITE_REVERB_APP_KEY or VITE_REVERB_HOST environment variables');
  console.warn('Real-time features will be disabled. Please check your .env file.');
  
  // Create a mock Echo object to prevent errors
  window.Echo = {
    channel: () => ({
      listen: () => console.warn('Echo not configured - add VITE_REVERB_APP_KEY and VITE_REVERB_HOST to .env file')
    }),
    leaveChannel: () => {}
  };
}

export default echo; 