import React from "react";

export default function Footer() {
  return (
    <footer className="py-4 mt-auto border-t">
      <div className="container mx-auto px-4 text-center">
        <a 
          href="https://njump.me/npub1vm9yc8sxa6e86duudxlmdullx9w89lxk3ucmkzj8c7yrfg5k8ueqk8j8wu" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          Find us on Nostr
        </a>
      </div>
    </footer>
  );
}