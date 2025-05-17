// WebSocket connection management
let socket: WebSocket | null = null;
let isConnecting = false;

// Setup the WebSocket connection with proper error handling
export function setupWebSocket(): WebSocket | null {
  // Don't try to connect if we're already connected or in the process of connecting
  if (isConnecting) {
    return socket;
  }
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return socket;
  }
  
  // Clean up any existing socket before creating a new one
  if (socket) {
    try {
      socket.close();
    } catch (err) {
      // Ignore errors during cleanup
    }
    socket = null;
  }
  
  try {
    // Set connecting flag to prevent multiple connection attempts
    isConnecting = true;
    
    // Only create WebSocket if we have a valid host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Skip WebSocket setup if host is invalid
    if (!host || host.includes('localhost:undefined')) {
      console.log('Skipping WebSocket setup due to invalid host');
      isConnecting = false;
      return null;
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    
    // Create a new WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Setup event handlers
    socket.onopen = () => {
      console.log('WebSocket connection established');
      isConnecting = false;
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
      isConnecting = false;
      // Don't set socket to null here, let the onclose handler do that
    };
    
    // Track reconnection attempts at module level to prevent multiple reconnection loops
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    
    socket.onclose = (event) => {
      console.log(`WebSocket closed with code ${event.code}: ${event.reason}`);
      
      // Reset connecting flag
      isConnecting = false;
      
      // Set socket to null to allow new connection attempts
      socket = null;
      
      // Only attempt reconnection for normal closures or network issues
      if ((event.code === 1000 || event.code === 1001 || event.code === 1006) &&
          reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        // Use a slightly longer delay between reconnection attempts
        setTimeout(() => {
          setupWebSocket();
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