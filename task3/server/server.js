// server/server.js

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server with CORS configuration
// This is crucial to allow connections from your frontend running on a different port/origin
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development. In production, restrict to your frontend's domain.
        methods: ["GET", "POST"]
    }
});

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doc_editor';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a Mongoose schema and model for our document
const DocumentSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Document ID (e.g., a room ID)
    content: { type: String, default: '' } // The actual text content of the document
});
const Document = mongoose.model('Document', DocumentSchema);

// --- Serve Static Frontend Files ---
// Serve files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Fallback for any other requests to serve index.html (SPA routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// --- Socket.IO Real-time Logic ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle 'join-document' event when a client wants to open a specific document
    socket.on('join-document', async (documentId) => {
        // Join the Socket.IO room specific to this document
        socket.join(documentId);
        console.log(`User ${socket.id} joined document: ${documentId}`);

        // Load the document content from MongoDB
        try {
            const document = await Document.findById(documentId);
            if (!document) {
                // If document doesn't exist, create a new one with empty content
                const newDocument = new Document({ _id: documentId, content: '' });
                await newDocument.save();
                console.log(`New document created: ${documentId}`);
                socket.emit('load-document', ''); // Send empty content to the client
            } else {
                // Send existing content to the client
                socket.emit('load-document', document.content);
            }
        } catch (error) {
            console.error(`Error loading document ${documentId}:`, error);
            socket.emit('load-document', 'Error loading document content.'); // Inform client of error
        }
    });

    // Handle 'send-changes' event when a client sends text changes
    socket.on('send-changes', async (documentId, delta) => {
        // Broadcast the changes to all other clients in the same document room
        // `socket.broadcast.to(documentId)` ensures the sender doesn't receive their own changes back
        socket.broadcast.to(documentId).emit('receive-changes', delta);

        // Update the document in MongoDB
        try {
            await Document.findByIdAndUpdate(documentId, { content: delta });
            // console.log(`Document ${documentId} updated in DB.`); // Log for debugging
        } catch (error) {
            console.error(`Error saving changes for document ${documentId}:`, error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// --- Start the Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Frontend served from: http://localhost:${PORT}`);
    console.log('Ensure MongoDB is running!');
});
