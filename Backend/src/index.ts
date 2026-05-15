import express from 'express';
import cors from 'cors';
import "dotenv/config";
import { clerkMiddleware } from '@clerk/express'
import { clearkWebhookHandler } from './webhooks/clerk';
import { getEnv } from './lib/env';


const env = getEnv();
const app = express();


const rawJson = express.raw({type: "application/json", limit: "1mb"});

// we don't need to parese the data which is comming as a webhook event, that data should be in raw format, and we will handle it in the clearkWebhookHandler function
//  so this place before app.use(express.json())
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clearkWebhookHandler(req, res);
});


app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());


app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});