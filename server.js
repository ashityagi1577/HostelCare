const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads and public client files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    app: 'HostelCare - Hostel Maintenance & Complaint Portal',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root welcome / status page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>HostelCare Portal</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 480px; text-align: center; }
            h1 { color: #38bdf8; margin: 0 0 0.5rem 0; font-size: 1.8rem; }
            .badge { display: inline-block; background: #064e3b; color: #34d399; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1.2rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0.5rem 0; }
            .endpoint { background: #0f172a; padding: 0.5rem 1rem; border-radius: 8px; font-family: monospace; color: #38bdf8; display: inline-block; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🏠 HostelCare</h1>
            <div class="badge">● Server Active & Online</div>
            <p>Hostel Maintenance & Complaint Portal Backend</p>
            <p>Phase 1 Environment & Foundation Operational</p>
            <div class="endpoint">GET /api/health</div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`[HostelCare] Server is running on http://localhost:${PORT}`);
  console.log(`[HostelCare] Health check available at http://localhost:${PORT}/api/health`);
});

module.exports = app;

