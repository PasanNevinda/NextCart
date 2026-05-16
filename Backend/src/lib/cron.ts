import {CronJob} from "cron";
import http from "node:http";
import https from "node:https";

// every 10 minutes and send a GET request to health endpoint to keep the server awake on the render
const job = new CronJob("*/10 * * * *", function () {
    const base = process.env.FRONTEND_URL;
    if(!base)
        return;
    const url = new URL("/health", base).href;
    const client = url.startsWith("https") ? https : http;

    client.get(url, (res) => {
        if(res.statusCode === 200){
            console.log("Health check successful");
        } else {
            console.error("Health check failed with status code:", res.statusCode);
        }}).on("error", (err) => {
            console.error("Error while sending request", err);
        })
});

export default job;
