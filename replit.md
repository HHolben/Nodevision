# Overview

Nodevision is a graph theory-inspired digital notebook system that visualizes file structures and content as interactive nodes and edges. The application provides a comprehensive platform for exploring, editing, and managing digital content through a graph-based interface, supporting multiple file formats including HTML, PHP, JavaScript, CSV, MIDI, PDF, and various media types.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Graph Visualization**: Built on Cytoscape.js with fcose layout algorithm and expand-collapse extensions for interactive network visualization
- **Multi-format Content Rendering**: Specialized renderers for different file types (HTML, PDF, MIDI, STL, CSV, etc.) with iframe-based display system
- **Real-time Editing**: Monaco Editor integration for code editing with syntax highlighting
- **Modular UI Components**: Toolbar system with JSON-driven configuration and callback-based functionality
- **Responsive Layout**: Flexible container system with draggable dividers and fullscreen capabilities

## Backend Architecture
- **Express.js Server**: RESTful API with middleware for authentication, file serving, and proxy capabilities
- **Dual Server Setup**: Node.js server (port 3000) with PHP server proxy (port 8080) for hybrid content support
- **Route Management**: JSON-driven route configuration system for modular API endpoint management
- **File System Integration**: Direct filesystem operations for notebook content management with security validation
- **Real-time Communication**: WebSocket support for live data streaming (oscilloscope functionality)

## Data Storage Solutions
- **PouchDB**: Document-based storage for user authentication and permissions management
- **File-based Storage**: Direct filesystem storage for notebook content with hierarchical organization
- **NodevisionDB**: Custom graph database integration for node and edge relationship management
- **Session Management**: Express-session with MemoryStore for user state persistence

## Authentication and Authorization
- **Passport.js Integration**: Local strategy authentication with bcrypt password hashing
- **Role-based Access Control**: Three-tier permission system (read, write, admin)
- **Session-based Authentication**: Secure session management with configurable storage options
- **Path Validation**: Security middleware preventing directory traversal attacks

## Graph Data Management
- **Dynamic Node Generation**: Automatic file system scanning to create graph nodes and regions
- **Link Extraction**: HTML content parsing to establish edges between related documents
- **Hierarchical Regions**: Directory-based grouping with expand/collapse functionality
- **Real-time Updates**: Live graph regeneration when file system changes occur

# External Dependencies

## Core Libraries
- **Cytoscape.js**: Graph visualization engine with layout algorithms (fcose, expand-collapse)
- **Express.js**: Web application framework for Node.js
- **Monaco Editor**: Code editor component for in-browser editing
- **Three.js**: 3D graphics library for STL and 3D model rendering
- **Cheerio**: Server-side HTML parsing for link extraction

## Authentication & Security
- **Passport.js**: Authentication middleware with local strategy support
- **bcrypt**: Password hashing for secure credential storage
- **express-session**: Session management middleware

## File Processing
- **Multer**: File upload handling middleware
- **Tesseract.js**: OCR processing for handwriting recognition
- **JSZip**: Archive file processing for ODT and other compressed formats
- **VexFlow**: Music notation rendering for MIDI files

## Database & Storage
- **PouchDB**: NoSQL document database for user management
- **NodevisionDB**: Custom graph database for relationship storage

## Development Tools
- **esbuild**: Fast JavaScript bundler for frontend assets
- **concurrently**: Process management for dual server setup
- **http-proxy-middleware**: Reverse proxy for PHP server integration
- **dotenv**: Environment variable management

## Media & Visualization
- **MathJax**: Mathematical notation rendering
- **Cropper.js**: Image cropping functionality
- **FontKit**: Font file processing and metadata extraction
- **@tonejs/midi**: MIDI file parsing and processing

## Hardware Integration
- **SerialPort**: Arduino and microcontroller communication
- **avrgirl-arduino**: Arduino firmware upload capabilities
- **WebSocket (ws)**: Real-time data streaming for oscilloscope functionality