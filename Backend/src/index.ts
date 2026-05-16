import express from 'express';
import cors from 'cors';
import "dotenv/config";

import fs from "node:fs";
import path from 'node:path';

import { clerkMiddleware } from '@clerk/express'
import { clearkWebhookHandler } from './webhooks/clerk';
import { getEnv } from './lib/env';
import keepAliveJob from './lib/cron';


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

app.get("/health", (_, res) => {
  res.status(200).json({ok: true});
});


const publicDir = path.join(process.cwd(), "public");

if(fs.existsSync(publicDir)){
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    if(req.method !== "GET" && req.method !== "HEAD"){
      next();
      return 
    }

    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}


app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
  if(env.NODE_ENV === "production"){
    keepAliveJob.start();
  }
});