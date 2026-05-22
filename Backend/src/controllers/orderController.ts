import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { getLocalUserById } from "../lib/users";
import { isStaff } from "../lib/roles";
import { db } from "../db";
import { orderItems, orders, products, users } from "../db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getEnv } from "../lib/env";
import { getStreamChatServer, streamChatDisplayName, streamUserId } from "../lib/stream";

const env = getEnv();

export async function listOrders(req: Request, res: Response, next: NextFunction){
    try {
        
        const {userId, isAuthenticated} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            res.status(503).json({error: "Account not synced yet"});
            return;
        }

        const rows = isStaff(localUser.role)
            ? await db.select().from(orders).orderBy(desc(orders.createdAt))
            : await db.select().from(orders).where(eq(orders.userId, localUser.id)).orderBy(desc(orders.createdAt));

        const orderIds = rows.map(r => r.id);
        const previewByOrder = new Map();

        if(orderIds.length > 0){
            const itemRows = await db
                .select({
                    orderId: orderItems.id,
                    quantity: orderItems.quantity,
                    name: products.name,
                    slug: products.slug,
                    imageUrl: products.imageUrl
                })
                .from(orderItems)
                .innerJoin(products, eq(orderItems.productId, products.id))
                .where(inArray(orderItems.id, orderIds))
                .orderBy(asc(orderItems.id))

            for(const item of itemRows){
                const list: Object[] = previewByOrder.get(item.orderId) || [];
                list.push({
                    name: item.name,
                    quantity: item.quantity,
                    slug: item.slug,
                    imageUrl: item.imageUrl,
                })

                previewByOrder.set(item.orderId, list);
            }
        }

        const ordersWithPreview = rows.map(order => ({
            ...order,
            previewItems: previewByOrder.get(order.id) ?? []
        }));

        res.status(200).json({orders: ordersWithPreview});

    } catch (error) {
        next(error);
    }
}


export async function getOrder(req: Request, res: Response, next: NextFunction){
    
    try {
        
        const {userId, isAuthenticated} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            res.status(503).json({error: "Account not synced yet"});
            return;
        }

        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, req.params.id as string))
            .limit(1);
        
        if(!order){
            res.status(404).json({error: "Not Found"});
            return;
        }

        const canAccess = isStaff(localUser.role) || order.userId === localUser.id;

        if(!canAccess){
            res.status(404).json({error: "Not found"});
        }

        const items = await db
            .select({
                id: orderItems.id,
                quantity: orderItems.quantity,
                unitPriceInCents: orderItems.unitPriceInCents,
                product: products
            })
            .from(orderItems)
            .innerJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

        res.json({order, items});

    } catch (error) {
        next(error)
    }
}

export async function createStreamChannel(req: Request, res: Response, next: NextFunction){

    try {
        
        const {userId, isAuthenticated} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            res.status(503).json({error: "Account not synced yet"});
            return;
        }

         const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, req.params.id as string))
            .limit(1);
        
        if(!order){
            res.status(404).json({error: "Not Found"});
            return;
        }

        const isOwner = order.userId === localUser.id;;
        if(!isOwner && !isStaff(localUser.role)){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        if( order.status !== "paid"){
            res.status(403).json({error: "Order must be paid to open support chat"});
            return;
        }

        const streamServer = getStreamChatServer(env);

        const streamChatUserId = streamUserId(userId);

        await streamServer.upsertUser({
            id: streamChatUserId,
            name: streamChatDisplayName(localUser.role, localUser.displayName, localUser.email),
        })

        const channelId = `order_${order.id}`;
        const channel = streamServer.channel("messaging", channelId, {
            name: `Support - Order ${order.id}`,
            created_by_id: streamChatUserId,
        });

        await channel.create();
        await channel.addMembers([streamChatUserId]);

        res.json({channelType: "messaging", channelId: channelId, streamUserId: streamChatUserId});

    } catch (error) {
        next(error)
    }

}

export async function createVideoInvite(req: Request, res: Response, next: NextFunction){

    try {
        
        const {userId, isAuthenticated} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            res.status(503).json({error: "Account not synced yet"});
            return;
        }

        if(!isStaff(localUser.role)){
            res.status(403).json({error: "Only support or admin can send a video invite"});
            return;
        }

         const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, req.params.id as string))
            .limit(1);
        
        if(!order || order.status !== "paid"){
            res.status(404).json({error: "Order not found or not paid"});
            return;
        }

        const [orderOwner] = await db
            .select()
            .from(users)
            .where(eq(users.id, order.userId))
            .limit(1);

        const CustomerStreamUserId = streamUserId(orderOwner.clerkUserId);

        const StreamServer = getStreamChatServer(env);

        await StreamServer.upsertUser({
            id: CustomerStreamUserId,
            name: orderOwner.displayName ?? orderOwner.email ?? "Customer"
        });

        const StaffStreamUserId = streamUserId(userId);
        await StreamServer.upsertUser({
            id: StaffStreamUserId,
            name: streamChatDisplayName(localUser.role, localUser.displayName, localUser.email)
        });

        const channelId = `order_${order.id}`;
        const channel = StreamServer.channel("messaging", channelId, {
            name: `Support - Order ${order.id}`,
            created_by_id: StaffStreamUserId,
        });

        await channel.create();
        await channel.addMembers([CustomerStreamUserId, StaffStreamUserId]);
        
        const joinUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/orders/${order.id}/call`;

        await channel.sendMessage({
            text: `Support has invited you to a video call regarding your order #${order.id}. Click the link to join: ${joinUrl}`,
            user_id: StaffStreamUserId,
            custom: {
                video_invite: true,
                join_url: joinUrl
            }
        });

        res.json({ok: true, joinUrl});

    } catch (error) {
        next(error);
    }

}