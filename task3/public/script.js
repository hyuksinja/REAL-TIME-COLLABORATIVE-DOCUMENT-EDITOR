// public/script.js

const editor = document.getElementById('document-editor');
const documentIdSpan = document.getElementById('document-id');
const copyIdButton = document.getElementById('copy-id-btn');
const newDocumentButton = document.getElementById('new-document-btn');
const connectionStatus = document.getElementById('connection-status');
const notificationBox = document.getElementById('notification-box');

let currentDocumentId = ''; // Stores the ID of the current document being edited
let isTyping = false; // Flag to prevent sending too many updates

// Initialize Socket.IO connection
// By default, it will try to connect to the host that served the current page
const socket = io(); // Connects to the backend server running on the same host and port

// --- Helper Functions ---

// Function to generate a simple unique ID for a new document
const generateUniqueId = () => {
    return Math.random().toString(36).substring(2, 10); // Generates an 8-character alphanumeric string
};

// Function to display temporary notifications
const showNotification = (message, type = 'info') => {
    notificationBox.textContent = message;
    notificationBox.className = `fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-lg z-50 text-center
                                 ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-gray-700'}
                                 text-white transition-all duration-300 transform scale-100 opacity-100`;
    notificationBox.classList.remove('hidden');
    setTimeout(() => {
        notificationBox.classList.add('opacity-0', 'scale-95');
        notificationBox.addEventListener('transitionend', () => {
            notificationBox.classList.add('hidden');
            notificationBox.classList.remove('opacity-0', 'scale-95');
        }, { once: true });
    }, 3000);
};

// Function to update the document ID in the URL and UI
const updateDocumentId = (newId) => {
    currentDocumentId = newId;
    documentIdSpan.textContent = newId;
    // Update URL without reloading the page
    history.pushState(null, '', `/${newId}`);
};

// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    console.log('Connected to server via Socket.IO');
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'text-sm text-green-500';

    // If the URL contains a document ID, try to join that document
    const pathId = window.location.pathname.substring(1); // Remove leading '/'
    if (pathId) {
        updateDocumentId(pathId);
        socket.emit('join-document', pathId);
    } else {
        // If no document ID in URL, create a new one
        const newId = generateUniqueId();
        updateDocumentId(newId);
        socket.emit('join-document', newId);
        showNotification('New document created. Share the URL to collaborate!', 'info');
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'text-sm text-red-500';
    showNotification('Disconnected from server. Trying to reconnect...', 'error');
});

socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err);
    connectionStatus.textContent = 'Connection Error';
    connectionStatus.className = 'text-sm text-red-500';
    showNotification('Could not connect to server. Ensure backend is running.', 'error');
});

// Event to load initial document content from the server
socket.on('load-document', (content) => {
    console.log('Document loaded:', content);
    editor.value = content;
    // Set focus to the end of the content
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    showNotification('Document loaded!', 'success');
});

// Event to receive changes from other collaborators
socket.on('receive-changes', (delta) => {
    // Only update if the user is not actively typing to avoid overwriting their input mid-stroke
    if (!isTyping) {
        editor.value = delta;
    }
});

// --- Editor Event Listeners ---

// Send changes to the server when the user types
editor.addEventListener('input', () => {
    isTyping = true; // Set typing flag
    socket.emit('send-changes', currentDocumentId, editor.value);
});

// Reset typing flag after a short delay (debouncing)
let typingTimer;
editor.addEventListener('keyup', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        isTyping = false;
    }, 200); // Adjust delay as needed
});


// --- Button Event Listeners ---

// Create a new document when the "New Document" button is clicked
newDocumentButton.addEventListener('click', () => {
    const newId = generateUniqueId();
    updateDocumentId(newId);
    editor.value = ''; // Clear editor for new document
    socket.emit('join-document', newId); // Join the new document room
    showNotification('New document created. Share the URL to collaborate!', 'info');
});

// Copy document ID to clipboard
copyIdButton.addEventListener('click', () => {
    // Use document.execCommand('copy') as navigator.clipboard.writeText might not work in some iframe environments
    const tempInput = document.createElement('textarea');
    tempInput.value = window.location.href; // Copy full URL for easier sharing
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        showNotification('Document URL copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showNotification('Failed to copy URL.', 'error');
    } finally {
        document.body.removeChild(tempInput);
    }
});

// --- Initial Setup ---
// If the page is loaded directly (not from a URL with a doc ID), a new ID will be generated
// This is handled in the socket.on('connect') event.
