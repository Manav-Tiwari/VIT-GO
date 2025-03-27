require("dotenv").config(); // Load .env if running locally
const https = require("https");

// Load environment variables
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
const RENDER_API_KEY = process.env.RENDER_API_KEY;

if (!RENDER_SERVICE_ID || !RENDER_API_KEY) {
    console.error("❌ Missing environment variables! Make sure RENDER_SERVICE_ID and RENDER_API_KEY are set.");
    process.exit(1);
}

const RENDER_RESTART_URL = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/restart`;
const HEALTH_CHECK_URL = "https://your-backend-url.com/health"; // Change to your actual health check endpoint

// Function to check server health
function checkServerHealth() {
    return new Promise((resolve, reject) => {
        https.get(HEALTH_CHECK_URL, (res) => {
            if (res.statusCode === 200) {
                resolve("✅ Server is healthy!");
            } else {
                reject(new Error(`⚠️ Server returned status: ${res.statusCode}`));
            }
        }).on("error", (err) => reject(new Error(`❌ Health check failed: ${err.message}`)));
    });
}

// Function to restart the Render service
function restartService() {
    return new Promise((resolve, reject) => {
        const options = {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${RENDER_API_KEY}`
            }
        };

        const req = https.request(RENDER_RESTART_URL, options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve("🔄 Successfully restarted Render service!");
                } else {
                    reject(new Error(`❌ Render API Error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on("error", (err) => reject(new Error(`❌ Restart request failed: ${err.message}`)));
        req.end();
    });
}

// Function to monitor the server and restart if needed
async function monitorServer() {
    try {
        const healthStatus = await checkServerHealth();
        console.log(healthStatus);
    } catch (error) {
        console.error(error.message);
        console.log("⚠️ Server is down! Restarting...");
        try {
            const restartStatus = await restartService();
            console.log(restartStatus);
        } catch (restartError) {
            console.error(restartError.message);
            process.exit(1);
        }
    }
}

// Run the health check
monitorServer();
