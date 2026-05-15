import type { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { parseRole } from "../lib/roles";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export async function clearkWebhookHandler(req:Request, res:Response) {
    const env = getEnv();

    try {
        // webhook verification to know request is coming from clerk or not
        if(!env.CLERK_WEBHOOK_SECRET) {
            res.status(503).send("Clerk webhook secret is not configured");
            return;
        }

        // clear's verifier expects the raw body of the request, so we need to use express.raw() middleware in the route handler for this webhook
        // otherwise express may give buffer or string format of the body, and that will cause the verification to fail
        const payLoad = req.body instanceof Buffer ? req.body.toString("utf-8"): String(req.body);

        const request = new Request("http://internal/webhooks/clerk", {
            method: "POST",
            headers: new Headers(req.headers as HeadersInit),
            body: payLoad
        });

        // throws if signature is wrong or body was tampered with; only then we trust the evt
        const evt = await verifyWebhook(request, {signingSecret: env.CLERK_WEBHOOK_SECRET});

        if(evt.type === "user.created" || evt.type === "user.updated") {
            const user = evt.data;

            const email = 
                user.email_addresses?.find((email) => email.id === user.primary_email_address_id)?.email_address ??
                user.email_addresses?.[0]?.email_address;

            const displayName = 
                [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                user.username || null;

            const role = parseRole(user.public_metadata?.role);

            await db.insert(users).values({
                clerkUserId: user.id,
                email,
                displayName,
                role,
            }).onConflictDoUpdate({
                target:users.clerkUserId,
                set: {email, displayName, role, updatedAt: new Date() }
            });
        }

        if(evt.type === "user.deleted"){
            const id = evt.data.id
            if(id){
                await db.delete(users).where(eq(users.clerkUserId, id));
            }
        }

        res.status(200).json({ok: true});

    } catch (error) {
        console.error("Clerk webhook error:", error);
        res.status(400).json({error: "Invalied webhook"});
    }
}