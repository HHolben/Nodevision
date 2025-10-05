# routes

The `routes` folder contains the backend code for Nodevision

## Purpose
The server coordinates file access, user authentication, and device communication.  
It also manages graph generation and provides APIs consumed by the front-end.

## Contents
- **API routes**: Endpoints for file operations, authentication, and graph data.
- **Middleware**: Security, logging, and error handling.
- **Login system**: User/device authentication using encrypted key files.
- **Integration layer**: Hooks for NodevisionDB (graph storage).

## Notes
- Written in Node.js (Express or similar).
- Avoid mixing server and client logic — client code should live under `public/`.