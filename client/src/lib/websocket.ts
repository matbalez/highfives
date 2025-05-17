// WebSocket connection management
let socket: WebSocket | null = null;

// Setup the WebSocket connection with proper error handling
export function setupWebSocket(): WebSocket | null {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return socket;
  }
  
  try {
    // Determine the correct WebSocket URL based on the current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
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
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket closed with code ${event.code}: ${event.reason}`);
      socket = null;
      
      // Auto-reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        setupWebSocket();
      }, 3000);
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