// WebSocket connection management
let socket: WebSocket | null = null;
let isConnecting = false;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Setup the WebSocket connection with proper error handling
export function setupWebSocket(): WebSocket | null {
  // Don't try to connect if we're already connecting or have a connection
  if (isConnecting) {
    return null;
  }
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }
  
  // Clear any existing socket that might be in a closing state
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      // Ignore errors on cleanup
    }
    socket = null;
  }
  
  try {
    isConnecting = true;
    
    // Only create WebSocket if we have a valid host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Skip WebSocket setup in certain environments
    if (!host || host.includes('localhost:undefined')) {
      isConnecting = false;
      return null;
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    
    // Create a new WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Connection opened
    socket.onopen = () => {
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Clear any pending reconnect timers
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    
    // Handle messages
    socket.onmessage = (event) => {
      // Handle incoming messages here (e.g., parse JSON data)
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        // Silently handle parsing errors
      }
    };
    
    // Handle errors
    socket.onerror = () => {
      // Let onclose handle the cleanup
    };
    
    // Connection closed
    socket.onclose = (event) => {
      const wasConnecting = isConnecting;
      isConnecting = false;
      
      // Set socket to null to allow reconnection attempts
      socket = null;
      
      // Only attempt to reconnect if we're not in HMR and haven't exceeded attempts
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        // Increment attempt counter
        reconnectAttempts++;
        
        // Clear any previous reconnect timer
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
        }
        
        // Use exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
        
        // Set a timer to reconnect
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          setupWebSocket();
        }, delay);
      } else if (wasConnecting) {
        // If this was a failed initial connection attempt,
        // reset the counter to allow future attempts
        reconnectAttempts = 0;
      }
    };
    
    return socket;
  } catch (err) {
    isConnecting = false;
    return null;
  }
}

// Function to handle incoming WebSocket messages
function handleWebSocketMessage(data: any) {
  // Example of handling different message types
  switch (data.type) {
    case 'highFiveCreated':
      console.log('New High Five created:', data.highFive);
      // You could update state here, e.g., refreshing lists, showing notifications
      break;
    case 'paymentReceived':
      console.log('Payment received:', data.payment);
      // Handle payment confirmation
      break;
    default:
      console.log('Unhandled message type:', data.type);
  }
}

// Function to send messages over WebSocket
export function sendWebSocketMessage(message: any) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  } else {
    console.error('WebSocket is not connected');
    // Try to reconnect
    setupWebSocket();
    return false;
  }
}

// Clean up WebSocket connection
export function closeWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}