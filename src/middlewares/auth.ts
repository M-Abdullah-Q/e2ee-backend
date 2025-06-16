import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ error: "Missing Auth token / Unauthorized" }, 401);
  }
  try {
    const payload = await verify(token, JWT_SECRET);
    c.set("user", payload.id as string);
    await next();
  } catch (e) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};
