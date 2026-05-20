import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export async function getLocalUserById(clerkUserId: string) {
    const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    return user;
}


