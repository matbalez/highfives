import React from "react";

export default function Footer() {
  return (
    <footer className="py-4 mt-auto border-t">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Left side - Nostr Link */}
          <div>
            <a 
              href="https://njump.me/npub1vm9yc8sxa6e86duudxlmdullx9w89lxk3ucmkzj8c7yrfg5k8ueqk8j8wu" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Find us on Nostr
            </a>
          </div>
          
          {/* Right side - Attribution */}
          <div className="text-right">
            <div>
              Built by <a 
                href="https://x.com/matbalez" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Mat Balez
              </a>
            </div>
          </div>
        </div>
        
        {/* Disclaimer text */}
        <div className="mt-2 text-gray-500 text-sm">
          Disclaimer: consider this vibe-coded app a prototype. Use with caution.
        </div>
      </div>
    </footer>
  );
}