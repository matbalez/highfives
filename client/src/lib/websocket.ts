// WebSocket connection management
let socket: WebSocket | null = null;

// Setup the WebSocket connection with proper error handling
export function setupWebSocket(): WebSocket | null {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return socket;
  }
  
  try {
    // Fixed approach: Only create WebSocket if we have a valid host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Skip WebSocket setup if host is invalid or we're in a development environment with HMR issues
    if (!host || host.includes('localhost:undefined')) {
      console.log('Skipping WebSocket setup due to invalid host or development environment');
      return null;
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    
    // Create a new WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Setup event handlers
    socket.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    socket.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      // Handle incoming messages here (e.g., parse JSON data)
      try {
        const data = JSON.parse(event.data);
        // Process data and dispatch actions as needed
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      socket = null;
    };
    
    // Track reconnection attempts at module level to prevent multiple reconnection loops
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    
    socket.onclose = (event) => {
      console.log(`WebSocket closed with code ${event.code}: ${event.reason}`);
      
      // Keep socket object null to prevent multiple reconnection attempts
      const currentSocket = socket;
      socket = null;
      
      // Only attempt reconnection if this is still the current socket
      // and if it was a normal closure or network issue
      if (
        currentSocket && 
        (event.code === 1000 || event.code === 1001 || event.code === 1006) &&
        reconnectAttempts < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        // Use a slightly longer delay between reconnection attempts
        setTimeout(() => {
          // Only try to reconnect if we still don't have a socket
          if (!socket) {
            setupWebSocket();
          }
        }, 5000); // 5 second delay
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached. WebSocket reconnection stopped.');
        // Reset reconnect attempts after a longer cool-down period
        setTimeout(() => {
          reconnectAttempts = 0;
        }, 30000); // 30 second cool-down
      }
    };
    
    return socket;
  } catch (err) {
    console.error('Failed to setup WebSocket connection:', err);
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