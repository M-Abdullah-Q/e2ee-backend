import { z } from "zod";
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

const postSchema = z.object({
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  convId: z.string().uuid(),
  cipherText: z.string(),
});

type postArgType = z.infer<typeof postSchema>;

type postRes = {
  error?: string;
  message?: {
    senderId: string;
    id: string;
    conversationId: string;
    recipientId: string;
    ciphertext: string;
    timestamp: Date;
  };
  status: number;
};

//todo fix promise type..............
const postMessage = async ({
  senderId,
  receiverId,
  convId,
  cipherText,
}: postArgType): Promise<postRes> => {
  if (!senderId || !receiverId || !convId) {
    return {
      error: "Bad Request",
      status: 502,
    };
  }
  try {
    const message = await prisma.message.create({
      data: {
        senderId: senderId,
        recipientId: receiverId,
        conversationId: convId,
        ciphertext: cipherText,
      },
    });

    return { ...message, status: 200 };
  } catch (error) {
    return {
      error: "Internal Server Error",
      status: 500,
    };
  }
};

export { postMessage, postSchema };
export type { postRes };
