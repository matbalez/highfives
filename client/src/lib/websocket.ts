// WebSocket connection management
let socket: WebSocket | null = null;

// Simple WebSocket setup that avoids errors during HMR
export function setupWebSocket(): WebSocket | null {
  // Only create one WebSocket connection
  if (socket) {
    return socket;
  }
  
  try {    
    // Don't set up WebSocket in a development context if we're in Vite's HMR
    if (import.meta.env.DEV && document.querySelector('script[type="module"]')) {
      return null; 
    }
    
    // Get host and construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Skip WebSocket setup if host is missing or invalid
    if (!host || host.includes('undefined')) {
      return null;
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    
    // Create WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Set up handlers with minimal error output
    socket.onopen = () => {};
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        // Silent error handling
      }
    };
    
    // Handle closing - simply clear the socket reference
    socket.onclose = () => {
      socket = null;
    };
    
    return socket;
  } catch (err) {
    socket = null;
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