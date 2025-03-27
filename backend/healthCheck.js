const { request } = require('node:https'); // Use native HTTPS request for CommonJS

const RENDER_API_KEY = process.env.RENDER_API_KEY || process.env.GITHUB_ENV.RENDER_API_KEY;
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL;

const RENDER_RESTART_URL = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/restart`;

// Function to check if the backend is running
const isServerUp = async () => {
    return new Promise((resolve) => {
        const req = request(HEALTH_CHECK_URL, { method: 'GET', timeout: 5000 }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 300);
        });

        req.on('error', () => resolve(false));
        req.end();
    });
};

// Function to restart the Render service
const restartService = async () => {
    return new Promise((resolve, reject) => {
        const req = request(RENDER_RESTART_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RENDER_API_KEY}`, // Ensure correct format
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`🔍 Render API Response: ${res.statusCode} - ${data}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ Successfully requested Render service restart.');
                    resolve();
                } else {
                    reject(new Error(`Render API Error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Error restarting the service:', error);
            reject(error);
        });

        req.end();
    });
};

// Function to continuously monitor the server
const monitorServer = async () => {
    while (true) {
        if (await isServerUp()) {
            console.log('✅ Server is running fine.');
        } else {
            console.warn('⚠️ Server is down! Restarting...');
            await restartService();
        }
        await new Promise(resolve => setTimeout(resolve, 300000)); // Wait 5 minutes
    }
};

// Start monitoring
monitorServer();
