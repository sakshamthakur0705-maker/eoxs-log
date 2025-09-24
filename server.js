const express = require('express');
const EOXSPlaywrightAutomationWithLog = require('./eoxs_playwright_automation_with_log');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'EOXS Log Automation',
        version: '1.0.0',
        endpoints: {
            'POST /automate': 'Run EOXS automation with provided parameters',
            'GET /health': 'Health check endpoint'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main automation endpoint
app.post('/automate', async (req, res) => {
    try {
        console.log('🚀 Received automation request:', req.body);
        
        // Set environment variables from request body
        const originalEnv = { ...process.env };
        
        // Update environment variables with request data
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined && req.body[key] !== null) {
                process.env[key] = String(req.body[key]);
            }
        });
        
        // Ensure headless mode for production
        if (process.env.NODE_ENV === 'production') {
            process.env.HEADLESS = 'true';
        }
        
        // Create and run automation
        const automation = new EOXSPlaywrightAutomationWithLog();
        const result = await automation.run();
        
        // Restore original environment
        process.env = originalEnv;
        
        console.log('✅ Automation completed:', result);
        
        res.json({
            success: result.success,
            data: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Automation failed:', error);
        
        // Restore original environment
        process.env = originalEnv;
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 EOXS Log Automation server running on port ${port}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Headless mode: ${process.env.HEADLESS || 'false'}`);
});

module.exports = app;
