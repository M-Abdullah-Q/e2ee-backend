import { Hono } from "hono";
import { prisma } from "../db";
import { validator } from "hono/validator";
import { z } from "zod";
import bcrypt from "bcrypt";

const authRoute = new Hono();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  publicKey: z.string(),
  username: z.string(),
});

// GET user route
authRoute.get("/user/:username", async (c) => {
  const username = c.req.param("username");

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        // don't return sensitive fields
      },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST signup route
authRoute.post(
  "/signup",
  validator("json", (value, c) => {
    const parsed = signupSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid inputs" }, 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const { email, password, publicKey, username } = c.req.valid("json");
    try {
      const hashedPassword = await bcrypt.hash(password, 10); // hash password

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          publicKey,
          username,
        },
      });

      return c.json(
        { email, username, message: "User created successfully" },
        200
      );
    } catch (error) {
      console.error(error);
      return c.json({ error: "User creation failed" }, 500);
    }
  }
);

// POST signin route
authRoute.post(
  "/signin",
  validator("json", (value, c) => {
    const schema = z.object({
      emailOrUsername: z.string(),
      password: z.string(),
    });
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid inputs" }, 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const { emailOrUsername, password: inputPassword } = c.req.valid("json");
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
        },
      });

      if (!user) {
        return c.json({ error: "User Not found" }, 404);
      }

      const isPasswordValid = await bcrypt.compare(
        inputPassword,
        user.password
      );

      if (!isPasswordValid) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      return c.json(
        {
          message: "Signin successful",
          email: user.email,
          username: user.username,
        },
        200
      );
    } catch (error) {
      console.error(error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

export default authRoute;
