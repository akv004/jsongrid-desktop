// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // ✅ CRITICAL: Import the global styles to apply the full-height fix.

/**
 * @name main
 * @description The main entry point for the React renderer process.
 * It finds the 'root' DOM element and renders the main App component into it.
 */
const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error("Failed to find the root element with ID 'root'")
}

const root = ReactDOM.createRoot(rootElement)
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)