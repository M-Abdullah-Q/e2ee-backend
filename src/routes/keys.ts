import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth";
import { prisma } from "../db";
import { error } from "console";

const keysRoute = new Hono();

keysRoute.get("/test", (c) => {
  return c.text("Keys Route");
});

keysRoute.get("/:userId", authMiddleware, async (c) => {
  const { userId } = c.req.param();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ publicKey: user.publicKey });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default keysRoute;
