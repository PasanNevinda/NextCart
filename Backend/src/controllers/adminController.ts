import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getLocalUserById } from "../lib/users";
import { isAdmin } from "../lib/roles";
import ImageKit from "@imagekit/nodejs";
import { getEnv } from "../lib/env";
import { db } from "../db";
import { products, orderItems } from "../db/schema";
import { count, desc, eq } from "drizzle-orm";
import z from "zod";
import { deleteImageKitAsset } from "../lib/imagekit";

const productCreateSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    category: z.string().min(1).default("General"),
    description: z.string().default(""),
    priceCents: z.number().int().positive(),
    currency: z.string().min(1).default("usd"),
    imageUrl: z.union([z.string().url(), z.literal("")]).optional().nullable(),
    imageKitFileId: z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
    active: z.boolean().default(true)
});

const productUpdateSchema = productCreateSchema.partial();

const env = getEnv();

function buildProductUpdateData(body: z.infer<typeof productUpdateSchema>){
    const data: Partial<typeof products.$inferInsert> = {};
    if(body.name !== undefined) data.name = body.name;
    if(body.slug !== undefined) data.slug = body.slug;
    if(body.category !== undefined) data.category = body.category;
    if(body.description !== undefined) data.description = body.description;
    if(body.priceCents !== undefined) data.priceCents = body.priceCents;
    if(body.currency !== undefined) data.currency = body.currency;
    if(body.active !== undefined) data.active = body.active;
    if(body.imageUrl !== undefined) data.imageUrl = body.imageUrl === "" ? null : body.imageUrl;
    if(body.imageKitFileId !== undefined) data.imageKitFileId = body.imageKitFileId === "" ? null : body.imageKitFileId;
    return data;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    
    try {
        const {userId, isAuthenticated} = getAuth(req);
        if(!isAuthenticated || !userId){
            res.status(401).json({error: "Unauthorized"});
            return;
        }

        const user = await getLocalUserById(userId);

        if(!isAdmin(user.role)){
            res.status(403).json({error: "Forbidden: Admin only"});
            return;
        }
        next();

    } catch(error){
        next(error);
    }
}


export function getImageKitAuth(_req: Request, res: Response, next: NextFunction) {
    
    try {
       const client = new ImageKit({privateKey: env.IMAGEKIT_PRIVATE_KEY});

       const auth = client.helper.getAuthenticationParameters();

       res.json({
        ...auth,
        publicKey: env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
       })

    } catch (error) {
        next(error)
    }
}

export async function listAdminProducts(_req: Request, res: Response, next: NextFunction){
    try {
        const rows = await db.select().from(products).orderBy(desc(products.createdAt));
        res.json({products: rows})
    } catch (error) {
        next(error)
    }
}


export async function createAdminProduct(req: Request, res: Response, next: NextFunction){
    
    try {
        const parsed = productCreateSchema.safeParse(req.body);
        if(!parsed.success){
            res.status(400).json({error: "Invalid request body", details: parsed.error.flatten()});
            return;
        }

        const {imageUrl, imageKitFileId, ...data} = parsed.data;
        const [row] = await db
            .insert(products)
            .values({
                ...data,
                imageUrl: imageUrl || null,
                imageKitFileId: imageKitFileId || null
            }).returning();

        res.status(201).json({product: row});

    } catch (error) {
        next(error)
    }
}


export async function updateAdminProduct(req: Request, res: Response, next: NextFunction){
    try {

        const parsed = productUpdateSchema.safeParse(req.body);
        if(!parsed.success){
            res.status(400).json({error: "Invalid request body", details: parsed.error.flatten()});
            return;
        }

        const data = buildProductUpdateData(parsed.data);

        if(Object.keys(data).length === 0){
            res.status(400).json({error: "No valid fields to update"});
            return;
        }

        const [updatedProduct] = await db.update(products).set(data).where(eq(products.id, req.params.id as string)).returning();

        if(!updatedProduct){
            res.status(404).json({error: "Product not found"});
            return;
        }

        res.json({product: updatedProduct});

    }catch (error) {
        next(error)
    }
}

export async function deleteAdminProduct(req: Request, res: Response, next: NextFunction){

    try{

        const id = req.params.id as string;
        const [product] = await db.select().from(products).where(eq(products.id, id));
        if(!product){
            res.status(404).json({error: "Product not found"});
            return;
        }

        // if the product has accosiated with a order, we should not delete it, instead we can set it as inactive
        const [countRows] = await db
            .select({c: count()})
            .from(orderItems)
            .where(eq(orderItems.productId, id));

        if(Number(countRows?.c ?? 0) > 0){
            res.status(409).json({error: "Cannot delete product that has associated orders. Consider setting it as inactive instead."});
            return;
        }

        await deleteImageKitAsset(env, product.imageKitFileId);
        await db.delete(products).where(eq(products.id, id));

        res.status(204).end();

    } catch (error) {
        next(error)
    }
}