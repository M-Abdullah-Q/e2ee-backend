import { Hono } from "hono";
import authRoute from "./routes/auth";

const PORT = process.env.PORT;

const app = new Hono();

app.get("/", (c) => c.text("Hello Welcome to the server"));
app.route("/auth", authRoute);
// app.route("/ws", ws);
// app.route("/keys", keys);

export default {
  port: PORT,
  fetch: app.fetch,
};
