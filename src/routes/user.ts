import { Hono } from "hono";
import { prisma } from "../db";
import { validator } from "hono/validator";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sign } from "hono/jwt";
import { authMiddleware } from "../middlewares/auth";

const userRoute = new Hono();
const JWT_SECRET = process.env.JWT_SECRET!;

userRoute.get("/user/:username", async (c) => {
  const username = c.req.param("username");
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, email: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const token = await sign({ id: user.id }, JWT_SECRET);
    return c.json({ ...user, token });
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

userRoute.get("/search/:key", authMiddleware, async (c) => {
  const key = c.req.param("key");
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: key, mode: "insensitive" } },
          { email: { contains: key, mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true },
    });
    return c.json({ users }, 200);
  } catch (error) {
    console.error("Error searching users:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

userRoute.post(
  "/signup",
  validator("json", (value, c) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
      publicKey: z.string(),
      username: z.string(),
    });
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      return c.json({ success: false, error: "Invalid inputs" }, 401);
    return parsed.data;
  }),
  async (c) => {
    const { email, password, publicKey, username } = c.req.valid("json");
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, publicKey, username },
      });

      const token = await sign({ id: user.id }, JWT_SECRET);

      return c.json({
        success: true,
        email,
        username,
        token,
        userID: user.id,
        message: "User created successfully",
      });
    } catch (error) {
      console.error(error);
      return c.json({ success: false, error: "User creation failed" }, 500);
    }
  }
);

userRoute.post(
  "/signin",
  validator("json", (value, c) => {
    const schema = z.object({
      emailOrUsername: z.string(),
      password: z.string(),
      publicKey: z.string(),
    });
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      return c.json({ success: false, error: "Invalid inputs" }, 401);
    return parsed.data;
  }),
  async (c) => {
    const { emailOrUsername, password, publicKey } = c.req.valid("json");
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
        },
      });

      if (!user)
        return c.json({ success: false, error: "User Not found" }, 404);

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid)
        return c.json({ error: "Invalid credentials" }, 401);

      const newUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          publicKey: publicKey,
        },
      });

      const token = await sign({ id: user.id }, JWT_SECRET);

      return c.json({
        success: true,
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
        publicKey: newUser.publicKey,
        token,
      });
    } catch (error) {
      console.error(error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
);

export default userRoute;
