import { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { checkoutSessions, orderItems, orders, productRelations } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { Webhook } from "standardwebhooks";

function headerString(headers: Request["headers"], key: string): string {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value || "";
}


async function alreadyPaid(polarOrderId?: string, checkOutId?: string){
    if(polarOrderId){
        const [row] = await db
            .select()
            .from(orders)
            .where(eq(orders.polarOrderId, polarOrderId))
            .limit(1);
        
        if(row?.status === "paid") return true;
    }

    if(checkOutId){
        const [row] = await db
            .select()
            .from(orders)
            .where(eq(orders.polarCheckoutId, checkOutId))
            .limit(1);
        
        if(row?.status === "paid") return true;
    }
    return false;
}

function checkoutSessionIdFromMetaData(order: Record<string, unknown>){
    const metadata = order.metadata;
    if(!metadata || typeof metadata !== "object") return undefined;
    const sessionId = (metadata as Record<string, unknown>).checkoutSessionId;
    return typeof sessionId === "string" ? sessionId : undefined;
}

async function fulfillCheckoutSession(sessionId: string, polarOrderId?: string, polarCheckoutId?: string){
    // Transaction (to execute both transaction or not at all)
    return await db.transaction(async tx => {
        const [session] = await tx
            .select()
            .from(checkoutSessions)
            .where(eq(checkoutSessions.id, sessionId))
            .for("update");

        if(!session) return false;

        const [order] = await tx
            .insert(orders)
            .values({
                userId: session.userId,
                status: "paid",
                totalCents: session.totalCents,
                polarCheckoutId: polarCheckoutId ?? session.polarCheckoutId ?? null,
                ...(polarOrderId ? {polarOrderId} : {}),
            })
            .returning();
        
        if (session.lines.length){
            await tx.insert(orderItems).values(
                session.lines.map(line => ({
                    orderId: order.id,
                    productId: line.productId,
                    quantity: line.quantity,
                    unitPriceInCents: line.unitPriceinCents,
                }))
            )
        }

        await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, sessionId));

        return true;
    })

}


export async function polarWebhookHandler(req: Request, res: Response) {
    const env = getEnv();

    try {
        
        if (!env.POLAR_WEBHOOK_SECRET){
            res.status(503).send("Polar webhook secret is not configured");
            return;
        }
    
        const raw = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));
        const wh = new Webhook(Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf-8").toString("base64"));
    
        const id = headerString(req.headers, "webhook-id");
        const ts = headerString(req.headers, "webhook-timestamp");
        const sig = headerString(req.headers, "webhook-signature");

        if(!id || !ts || !sig){
            res.status(400).send("Missing required webhook headers");
            return;
        }

        wh.verify(raw, {"webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig});

        const event = JSON.parse(raw.toString("utf-8")) as {
            type: string;
            data?: Record<string, unknown>;
        };

        if(event.type === "order.paid" && event.data){
            const data = event.data;
            const polarOrderId = typeof data.id === "string" ? data.id : undefined;
            const checkoutId = typeof data.checkout_id === "string" ? data.checkout_id : undefined;

            if( await alreadyPaid(polarOrderId, checkoutId)){
                res.json({ok: true, duplicate: true});
                return
            }

            const sessionId = checkoutSessionIdFromMetaData(data);

            if(sessionId){
                const ok = await fulfillCheckoutSession(sessionId, polarOrderId, checkoutId);

                if(ok){
                    res.json({ok: true});
                    return;
                }

                if (await alreadyPaid(polarOrderId, checkoutId)){
                    res.json({ok: true, duplicate: true});
                    return;
                }

                console.error("Polar order paid: could not fullfill checkout session", {
                    sessionId,
                    checkoutId
                });
            }
            
        }

        res.json({ok: true});

    } catch (error) {
        console.error("Error handling Polar webhook", error);
        res.status(400).json({error: "Invalid webhook event"});
    }
}