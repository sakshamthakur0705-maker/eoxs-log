const express = require('express');
const EOXSPlaywrightAutomationWithLog = require('./eoxs_playwright_automation_with_log');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// In-memory job store (use Redis in production)
const jobs = new Map();

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
            'GET /health': 'Health check endpoint',
            'GET /healthz': 'Health check endpoint (for platforms)',
            'GET /status/:jobId': 'Check job status by ID'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Alias for platforms that probe /healthz
app.get('/healthz', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Job status endpoint
app.get('/status/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);
    
    if (!job) {
        return res.status(404).json({
            success: false,
            error: 'Job not found',
            jobId: jobId
        });
    }
    
    res.json({
        jobId: jobId,
        status: job.status,
        result: job.result,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        duration: job.completedAt ? (new Date(job.completedAt) - new Date(job.createdAt)) / 1000 : null
    });
});

// Main automation endpoint
app.post('/automate', async (req, res) => {
    // Allow long running requests (Render default is short)
    try {
        // Per-request timeout extension (15 minutes)
        req.setTimeout(15 * 60 * 1000);
        res.setTimeout(15 * 60 * 1000);

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
        
        // If client requests async mode, acknowledge early
        const waitForResponse = String(req.body.waitForResponse ?? 'true') === 'true';
        if (!waitForResponse) {
            // Create job and run in background
            const jobId = uuidv4();
            const job = {
                id: jobId,
                status: 'running',
                createdAt: new Date().toISOString(),
                result: null,
                completedAt: null
            };
            jobs.set(jobId, job);
            
            // Run without blocking the response
            (async () => {
                try {
                    const automationBg = new EOXSPlaywrightAutomationWithLog();
                    const result = await automationBg.run();
                    job.status = 'completed';
                    job.result = result;
                    job.completedAt = new Date().toISOString();
                } catch (error) {
                    job.status = 'failed';
                    job.result = { success: false, error: error.message };
                    job.completedAt = new Date().toISOString();
                }
            })();
            
            return res.status(202).json({ 
                accepted: true, 
                message: 'Automation started', 
                jobId: jobId,
                statusUrl: `/status/${jobId}`,
                timestamp: new Date().toISOString() 
            });
        }

        // Create and run automation (blocking until finished)
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
        // Attempt best-effort env restore if available
        try { if (typeof originalEnv !== 'undefined') process.env = originalEnv; } catch {}
        
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
const server = app.listen(port, () => {
    console.log(`🚀 EOXS Log Automation server running on port ${port}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Headless mode: ${process.env.HEADLESS || 'false'}`);
});

// Extend server timeouts (15 minutes) for long Playwright sessions
try {
    server.headersTimeout = 16 * 60 * 1000; // headers timeout slightly higher
    server.requestTimeout = 15 * 60 * 1000; // node >=18
    if (typeof server.setTimeout === 'function') {
        server.setTimeout(15 * 60 * 1000);
    }
} catch (e) {
    console.warn('⚠️ Could not extend server timeouts:', e?.message);
}

module.exports = app;
