import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth";
import { validator } from "hono/validator";
import { z } from "zod";
import { prisma } from "../db";
import { success } from "zod/v4";

type Variables = {
  user: string;
};

const conversationRoute = new Hono<{ Variables: Variables }>();

conversationRoute.post(
  "/new",
  authMiddleware,
  validator("json", (value, c) => {
    const schema = z.object({
      user1Id: z.string().uuid(),
      user2Id: z.string().uuid(),
    });
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid Request" }, 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const { user1Id, user2Id } = c.req.valid("json");
    const currentId = c.get("user");

    const [first, second]: [string, string] = [user1Id, user2Id].sort() as [
      string,
      string
    ];

    const otherUserId = currentId === user1Id ? user2Id : user1Id;

    try {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id: first, user2Id: second },
            { user1Id: second, user2Id: first },
          ],
        },
      });

      if (existingConversation) {
        return c.json(
          {
            message: "Conversation already exists",
            conversation: existingConversation,
          },
          200
        );
      }

      const conversation = await prisma.conversation.create({
        data: {
          user1Id: first,
          user2Id: second,
        },
      });

      const user2 = await prisma.user.findUnique({
        where: { id: otherUserId },
      });
      // const user2 = await prisma.user.findUnique({ where: { id: second } });

      return c.json(
        {
          success: true,
          conversationId: conversation.id,
          publicKey: user2?.publicKey,
        },
        201
      );
    } catch (error) {
      console.error("Error creating conversation:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

export default conversationRoute;
