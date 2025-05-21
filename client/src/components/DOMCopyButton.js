// This script creates a vanilla JS copy button that exists outside of React's control

// Function to add a copy button to a specific element
export function addCopyButton(containerSelector, textToCopy, toastFunction) {
  // Remove any existing button first
  removeCopyButton();
  
  // Find the container where we'll insert the button
  const container = document.querySelector(containerSelector);
  if (!container) return false;
  
  // Create the button element
  const button = document.createElement('button');
  button.id = 'vanilla-copy-button';
  button.className = 'vanilla-copy-btn';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copy payment instructions</span>
  `;
  
  // Add click event that doesn't interfere with React
  button.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Use clipboard API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          if (toastFunction) toastFunction({
            title: 'Copied!',
            description: 'Payment instructions copied to clipboard'
          });
        })
        .catch(err => {
          console.error('Failed to copy using Clipboard API:', err);
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
    
    // Fallback copy method
    function fallbackCopy() {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful && toastFunction) {
          toastFunction({
            title: 'Copied!',
            description: 'Payment instructions copied to clipboard'
          });
        }
      } catch (err) {
        console.error('Failed to copy:', err);
        document.body.removeChild(textarea);
      }
    }
  });
  
  // Add the button to the container
  container.appendChild(button);
  return true;
}

// Function to remove the copy button
export function removeCopyButton() {
  const existingButton = document.getElementById('vanilla-copy-button');
  if (existingButton) {
    existingButton.parentNode.removeChild(existingButton);
  }
}