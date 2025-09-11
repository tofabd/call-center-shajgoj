import Echo from 'laravel-echo';

// Extend window type for global variables
declare global {
  interface Window {
    Echo: any;
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
    // For development, connect directly to Reverb without nginx proxy
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    echo = new Echo({
      broadcaster: 'reverb',
      key: reverbKey,
      wsHost: reverbHost,
      wsPort: reverbScheme === 'https' ? 443 : (reverbPort ?? 8080),
      wssPort: 443,
      // Only use wsPath for production (nginx proxy)
      ...(isProduction ? { wsPath: '/app/' } : {}),
      forceTLS: reverbScheme === 'https',
      enabledTransports: ['ws', 'wss'],
      auth: {
        headers: {},
      },
    });

    window.Echo = echo;
    console.log('✅ Echo initialized successfully with Laravel Reverb', {
      host: reverbHost,
      port: reverbScheme === 'https' ? 443 : (reverbPort ?? 8080),
      scheme: reverbScheme,
      wsPath: isProduction ? '/app/' : 'none (direct connection)',
      forceTLS: reverbScheme === 'https',
      environment: isProduction ? 'production' : 'development'
    });
  } catch (error) {
    console.error('❌ Failed to initialize Echo with Reverb:', error);
  }
}

// If Reverb failed, create mock Echo
if (!echo) {
  console.warn('⚠️ Echo not initialized - missing Reverb configuration');
  console.warn('Real-time features will be disabled. Please check your .env file.');
  console.warn('Required variables: VITE_REVERB_APP_KEY, VITE_REVERB_HOST, VITE_REVERB_PORT, VITE_REVERB_SCHEME');
  
  window.Echo = {
    channel: () => ({
      listen: () => console.warn('Echo not configured - add Reverb configuration to .env file')
    }),
    leaveChannel: () => {}
  };
}

export default echo; 