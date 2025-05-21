// This file contains a global function to copy text that can be called from anywhere

// Add a global copy function to the window object
window.copyToClipboard = function(text) {
  // Return a promise that resolves when copy is complete
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary element
      const tempElement = document.createElement('textarea');
      tempElement.value = text;
      tempElement.setAttribute('readonly', '');
      tempElement.style.position = 'absolute';
      tempElement.style.left = '-9999px';
      document.body.appendChild(tempElement);
      
      // Select and copy text
      tempElement.select();
      document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(tempElement);
      
      // Resolve the promise
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};