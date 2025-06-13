import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth";
import { validator } from "hono/validator";
import { postSchema, type postRes } from "../lib/message";
import { postMessage } from "../lib/message";
import { prisma } from "../db";

const messageRoute = new Hono();

messageRoute.get("/bulk", authMiddleware); //implement this route for history chcking

messageRoute.get(
  "/unseen",
  authMiddleware,
  validator("json", (value, c) => {
    const schema = z.object({
      userId: z.string().uuid(),
      timestamp: z.string(), //utc string called iso
    });

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Bad Request" }, 502);
    }

    return parsed.data;
  }),
  async (c) => {
    const { userId, timestamp } = c.req.valid("json");

    try {
      const messages = await prisma.message.findMany({
        where: {
          recipientId: userId,
          timestamp: {
            gt: new Date(timestamp),
          },
        },
      });

      return c.json({ messages }, 200);
    } catch (error) {
      return c.json({ error: error }, 500);
    }
  }
);

messageRoute.post(
  "/",
  authMiddleware,
  validator("json", (value, c) => {
    const schema = postSchema;

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Bad Request" }, 502);
    }

    return parsed.data;
  }),
  async (c) => {
    const { senderId, receiverId, convId, cipherText } = c.req.valid("json");

    try {
      const postRes: postRes = await postMessage({
        senderId,
        receiverId,
        convId,
        cipherText,
      });

      if (postRes.status != 200) {
        return c.json(
          { error: postRes?.error || "Internal Server Error" },
          (postRes?.status as any) || 500
        );
      }

      return c.json({ message: postRes?.message }, 200);
    } catch (error) {
      return c.json({ error: "Internal server Eror" }, 500);
    }
  }
);

export default messageRoute;
