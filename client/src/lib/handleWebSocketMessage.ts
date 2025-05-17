// WebSocket message handler
export function handleWebSocketMessage(data: any) {
  try {
    // Skip welcome messages as they're just confirmation
    if (data.type === 'welcome') {
      return;
    }
    
    // Handle different message types
    switch (data.type) {
      case 'highFiveCreated':
        console.log('New High Five created:', data.highFive);
        // You could update state here, e.g., refreshing lists, showing notifications
        break;
      case 'paymentReceived':
        console.log('Payment received:', data.payment);
        // Handle payment confirmation
        break;
      case 'confirmation':
        // Message confirmed by server, no need to do anything
        break;
      default:
        console.log('Received message type:', data.type);
    }
  } catch (err) {
    console.error('Error handling WebSocket message:', err);
  }
}