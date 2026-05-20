import { Request, Response, NextFunction } from "express";
import { getEnv } from "../lib/env";
import z from "zod";
import { getAuth } from "@clerk/express";
import { getLocalUserById } from "../lib/users";
import { db } from "../db";
import { CheckoutSessionLine, checkoutSessions, products } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { createPolarCheckout } from "../lib/polar";


const env = getEnv();

const cartSchema = z.object({
    items: z.array(
        z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
        })
    ).min(1)
});

export async function createCheckout(req: Request, res: Response, next: NextFunction){
    try {
        const {isAuthenticated, userId} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const parsedData = cartSchema.safeParse(req.body);
        if(!parsedData.success){
            res.status(400).json({error: "Invalid request body", details: parsedData.error.errors});
            return;
        }

        // polar access is required
        if(!env.POLAR_ACCESS_TOKEN){
            res.status(503).json({error: "Payment processing is not configured"});
            return;
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            res.status(503).json({error: "Account not Synced yet"});
            return;
        }

        const productIds = parsedData.data.items.map(item => item.productId);

        const prodRows = await db.select().from(products)
                                    .where(and(inArray(products.id, productIds), eq(products.active, true)));  

        if(prodRows.length !== productIds.length){
            res.status(400).json({error: "Some products are not available"});
            return;
        }

        const byId = new Map(prodRows.map(p => [p.id, p]));
        let totalCents = 0;
        const lines: CheckoutSessionLine[] = [];

        for(const item of parsedData.data.items){
            const prod = byId.get(item.productId)!;
            totalCents += prod.priceCents * item.quantity;
            lines.push({
                productId: prod.id,
                quantity: item.quantity,
                unitPriceinCents: prod.priceCents
            });
        }

        if(totalCents < 10){
            res.status(400).json({error: "Total amount must be greater than 10 cents (Polar minimum requirement)"});
            return;
        }

        const [checkoutSession] = await db
            .insert(checkoutSessions)
            .values({
                userId: localUser.id,
                lines,
                totalCents,
                currency: "USD"
            })
            .returning();

        const returnUrl = `${env.FRONTEND_URL}/cart`;
        const successUrl = `${env.FRONTEND_URL}/checkout/return?checkout_id={CHECKOUT_SESSION_ID}`;

        const polarCheckout = await createPolarCheckout(env, {
            products: [env.POLAR_CHECKOUT_PRODUCT_ID],
            prices: {
                [env.POLAR_CHECKOUT_PRODUCT_ID]: [
                    {
                        amount_type: "fixed",
                        price_currency: "usd",
                        price_amount: totalCents
                    }
                ]
            },
            success_url: successUrl,
            return_url: returnUrl,
            external_customer_id: userId,
            metadata: {
                checkoutSessionId: checkoutSession.id
            }
        })

        await db.update(checkoutSessions).set({polarCheckoutId: polarCheckout.id})
            .where(eq(checkoutSessions.id, checkoutSession.id));

        res.json({checkoutUrl: polarCheckout.url});

    } catch (error) {
        next(error);
    }
}