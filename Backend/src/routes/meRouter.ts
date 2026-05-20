import { getAuth } from "@clerk/express";
import { Router } from "express";
import { getLocalUserById } from "../lib/users";

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const {isAuthenticated, userId} = getAuth(req);
        if(!userId || !isAuthenticated){
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await getLocalUserById(userId);
        res.json({user});

    } catch (error) {
        next(error);
    }
});

export default router;