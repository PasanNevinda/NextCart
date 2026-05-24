import "dotenv/config";
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { getEnv } from "./lib/env"

const env = getEnv()
const dsn = env.SENTRY_DSN

// node profiling integration is for performance monitoring, it is not required for error monitoring

if(dsn){
    Sentry.init({
        dsn,
        environment: env.NODE_ENV ?? "development",
        integrations: [nodeProfilingIntegration()],
        enableLogs: true,
        tracesSampleRate: 1.0, // Adjust this value in production as needed
        profilesSampleRate: 1.0, // Adjust this value in production as needed
        profileLifecycle: "trace", // Automatically link profiles to their corresponding traces
        sendDefaultPii: true, // Send personally identifiable information (PII) if needed
    })
}