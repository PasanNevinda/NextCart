import { Request, Response, NextFunction } from "express";
import { getEnv } from "../lib/env.js";
import { getAuth, clerkClient } from "@clerk/express";
import { getLocalUserById } from "../lib/users.js";
import { getStreamChatServer, streamUserId, streamChatDisplayName } from "../lib/stream.js";

const env = getEnv();

export async function createStreamToken(req: Request, res: Response, next: NextFunction) {

    try {
        const {isAuthenticated, userId} = getAuth(req);
        if(!userId || !isAuthenticated){
            return res.status(401).json({ error: "Unauthorized" });
        }

        const localUser = await getLocalUserById(userId);
        if(!localUser){
            return res.status(503).json({ error: "Account not synced yet" });
        }

        const server = getStreamChatServer(env);

        const clerkUser = await clerkClient.users.getUser(userId);

        const combined = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

        const name = streamChatDisplayName(localUser.role, 
            localUser.displayName ?? combined ?? clerkUser.username,
            localUser.email
        )

        const image = clerkUser.imageUrl ?? undefined;
        const streamId = streamUserId(userId);

        await server.upsertUser({
            id: streamId,
            name,
            image,
        });

        const token = server.createToken(streamId);

        res.json({token, apiKey: env.STREAM_API_KEY, userId: streamId});

    } catch (error) {
        next(error);
    }
}