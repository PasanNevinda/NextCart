import ImageKit, {NotFoundError} from "@imagekit/nodejs";
import type { Env } from "./env.js";


// delete imagekit file by "fileId" from out DB
export async function deleteImageKitAsset(env: Env, storedFileId: string | null){
    if(!storedFileId) return;

    const client = new ImageKit({
        privateKey: env.IMAGEKIT_PRIVATE_KEY
    });

    try{
        await client.files.delete(storedFileId);

    } catch(e: unknown){
        if (e instanceof NotFoundError) return;
        throw e;
    }
}