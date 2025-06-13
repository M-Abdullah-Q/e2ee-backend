import { Hono } from "hono";
import userRoute from "./routes/user";
import keysRoute from "./routes/keys";
import conversationRoute from "./routes/conversations";
import messageRoute from "./routes/message";
import { cors } from "hono/cors";
import { upgradeWebSocket, wsHandler, websocket } from "./routes/ws/ws";

const PORT = process.env.PORT;

const app = new Hono();

app.use("*", async (c, next) => {
  console.log(c.req.url);
  await next();
});

app.get("/ws", upgradeWebSocket(wsHandler)); //implement ws route handler

//cors here
app.use("/*", cors());

app.get("/", (c) => c.text("Hello Welcome to the server"));
app.route("/user", userRoute);
app.route("/keys", keysRoute);
app.route("/conversation", conversationRoute);
app.route("message", messageRoute);

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
};

// LFG!! this works
// Vite + React (Scaffold this too)

//to do : LibSodium integration
