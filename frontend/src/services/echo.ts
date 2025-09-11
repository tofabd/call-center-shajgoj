import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Make Pusher available globally for Laravel Echo
window.Pusher = Pusher;

// Extend window type for global variables
declare global {
  interface Window {
    Echo: any;
    Pusher: any;
  }
}

// Initialize Echo with Laravel Reverb
let echo: any = null;

const reverbKey = import.meta.env.VITE_REVERB_APP_KEY;
const reverbHost = import.meta.env.VITE_REVERB_HOST;
const reverbPort = import.meta.env.VITE_REVERB_PORT;
const reverbScheme = import.meta.env.VITE_REVERB_SCHEME;

if (reverbKey && reverbHost) {
  try {
    console.log('🔌 Attempting to initialize Echo with Reverb...', {
      key: reverbKey ? 'present' : 'missing',
      host: reverbHost,
      port: reverbPort,
      scheme: reverbScheme
    });
    
    echo = new Echo({
      broadcaster: 'pusher',
      key: reverbKey,
      wsHost: reverbHost,
      wsPort: parseInt(reverbPort) || 443,
      wssPort: parseInt(reverbPort) || 443,
      forceTLS: reverbScheme === 'https',
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      cluster: '',
      encrypted: reverbScheme === 'https',
      auth: {
        headers: {
          'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : undefined
        }
      },
      authEndpoint: `${import.meta.env.VITE_API_URL}/broadcasting/auth`,
    });

    // Add connection event listeners for debugging
    if (echo.connector && echo.connector.pusher) {
      echo.connector.pusher.connection.bind('connected', () => {
        console.log('🔌 WebSocket connected successfully');
      });
      
      echo.connector.pusher.connection.bind('disconnected', () => {
        console.log('🔌 WebSocket disconnected');
      });
      
      echo.connector.pusher.connection.bind('error', (error: any) => {
        console.error('🔌 WebSocket connection error:', error);
      });

      echo.connector.pusher.connection.bind('state_change', (states: any) => {
        console.log('🔌 WebSocket state change:', states);
      });
    }

    window.Echo = echo;
    console.log('✅ Echo initialized successfully with Laravel Reverb', {
      host: reverbHost,
      port: parseInt(reverbPort) || 443,
      scheme: reverbScheme,
      forceTLS: reverbScheme === 'https',
      encrypted: reverbScheme === 'https'
    });
  } catch (error) {
    console.error('❌ Failed to initialize Echo with Reverb:', error);
    console.error('🔍 Debug info:', {
      reverbKey: reverbKey ? 'present' : 'missing',
      reverbHost,
      reverbPort,
      reverbScheme,
      userAgent: navigator.userAgent
    });
  }
}

// If Reverb failed, create mock Echo
if (!echo) {
  console.warn('⚠️ Echo not initialized - missing Reverb configuration');
  console.warn('Real-time features will be disabled. Please check your .env file.');
  console.warn('Required variables: VITE_REVERB_APP_KEY, VITE_REVERB_HOST, VITE_REVERB_PORT, VITE_REVERB_SCHEME');
  
  window.Echo = {
    channel: (name: string) => ({
      listen: (event: string, callback?: Function) => {
        console.warn(`Echo not configured - cannot listen to ${name}:${event}`);
        return {
          stopListening: () => {},
          listen: () => this
        };
      }
    }),
    leaveChannel: (name: string) => {
      console.warn(`Echo not configured - cannot leave channel ${name}`);
    },
    connector: null
  };
}

export const getEchoStatus = () => {
  if (!echo) {
    return {
      available: false,
      connected: false,
      status: 'unavailable',
      message: 'Echo not initialized'
    };
  }

  let connected = false;
  let status = 'disconnected';

  // Check Reverb connection status
  if (echo.connector && echo.connector.pusher) {
    const connectionState = echo.connector.pusher.connection.state;
    connected = connectionState === 'connected';
    status = connectionState;
  }

  return {
    available: true,
    connected,
    status,
    message: connected ? 'WebSocket connected' : `WebSocket ${status}`
  };
};

export default echo; 