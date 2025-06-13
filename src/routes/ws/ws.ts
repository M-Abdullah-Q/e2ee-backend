import { createBunWebSocket } from "hono/bun";
import type { Context } from "hono";
import type { WSEvents, WSContext } from "hono/ws";
import { prisma } from "../../db";
import {
  addUserConnection,
  removeUserConnection,
  joinConversation,
  getUserSocket,
} from "./connections";
import type { BinaryType, ServerWebSocket, WebSocket } from "bun";
import { postMessage } from "../../lib/message";
import { verify } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

export function wsHandler(c: Context) {
  let userId: string;

  return {
    async onOpen(evt: Event, ws: WSContext<ServerWebSocket>) {
      const url = new URL(c.req.url);
      //auth
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(1008, "Unsuccessful Authorization");
        return;
      }
      try {
        const payload = await verify(token, JWT_SECRET);
      } catch (e) {
        ws.close(1008, "Invalid or Expired Token");
      }
      //id
      const userIdparam = url.searchParams.get("userId");
      if (!userIdparam) {
        ws.close(1008, "Missing useId");
        return;
      }
      userId = userIdparam;
      addUserConnection(userId, ws.raw);
      console.log(`🟢 WS open for user ${userId}`);
    },
    async onMessage(evt: MessageEvent, ws: WSContext<ServerWebSocket>) {
      let data: any;
      try {
        if (typeof evt.data === "string") {
          data = JSON.parse(evt.data);
        } else {
          return;
        }
      } catch (e) {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      switch (data.type) {
        case "join": {
          // { type: "join", conversationId }
          joinConversation(data.conversationId, userId);
          break;
        }
        case "message": {
          // { type: "message", conversationId, recipientId, ciphertext }
          const { conversationId, recipientId, ciphertext } = data;

          // 1. forward if online
          const recip = getUserSocket(recipientId);
          if (recip) {
            recip.send(
              JSON.stringify({
                type: "message",
                conversationId,
                from: userId,
                ciphertext,
                timestamp: new Date().toISOString(),
              })
            );
          }

          // 2. persist in background
          try {
            await postMessage({
              senderId: userId,
              receiverId: recipientId,
              convId: conversationId,
              cipherText: ciphertext,
            });
          } catch (e) {
            console.error("DB write error", e);
          }
          break;
        }
        default: {
          ws.send(JSON.stringify({ error: "Unknown message type" }));
        }
      }
    },
    onClose(evt: Event, ws: WSContext<ServerWebSocket>) {
      if (userId) {
        removeUserConnection(userId);
        console.log(`🔴 WS closed for user ${userId}`);
      }
    },
    onError(evt: Event, ws: WSContext<ServerWebSocket>) {
      console.error(`⚠️ WS error for ${userId}:`, evt);
    },
  };
}

// // 2) Define the WS handler factory
// export function wsHandler2(c: Context) {
//   return {
//     // Called once per new connection
//     open(ws: WebSocket) {
//       const url = new URL(c.req.url);
//       const userId = url.searchParams.get("userId");
//       if (!userId) {
//         ws.close(1008, "Missing userId");
//         return;
//       }
//       // Attach userId to the socket (we'll cast to `any` to store it)
//       (ws as any)._userId = userId;
//       addUserConnection(userId, ws);
//       console.log(`🟢 WS open for user ${userId}`);
//     },

//     // Called on each incoming message
//     async message(ws: WebSocket, raw: string | ArrayBuffer) {
//       let data: any;
//       try {
//         if (typeof raw === "string") {
//           data = JSON.parse(raw);
//         } else {
//           // ignore binary
//           return;
//         }
//       } catch {
//         ws.send(JSON.stringify({ error: "Invalid JSON" }));
//         return;
//       }

//       const userId = (ws as any)._userId as string;
//       switch (data.type) {
//         case "join": {
//           // { type: "join", conversationId }
//           joinConversation(data.conversationId, userId);
//           break;
//         }
//         case "message": {
//           // { type: "message", conversationId, recipientId, ciphertext }
//           const { conversationId, recipientId, ciphertext } = data;

//           // 1. forward immediately if online
//           const recip = getUserSocket(recipientId);
//           if (recip) {
//             recip.send(
//               JSON.stringify({
//                 type: "message",
//                 conversationId,
//                 from: userId,
//                 ciphertext,
//                 timestamp: new Date().toISOString(),
//               })
//             );
//           }

//           // 2. persist in background
//           try {
//             await postMessage({
//               userId,
//               reciverId: recipientId,
//               convId: conversationId,
//               cipherText: ciphertext,
//             });
//           } catch (e) {
//             console.error("DB write error", e);
//           }
//           break;
//         }
//         default: {
//           ws.send(JSON.stringify({ error: "Unknown message type" }));
//         }
//       }
//     },

//     // Called when the socket closes
//     close(ws: WebSocket) {
//       const userId = (ws as any)._userId as string | undefined;
//       if (userId) {
//         removeUserConnection(userId);
//         console.log(`🔴 WS closed for user ${userId}`);
//       }
//     },

//     // Called on socket error
//     error(ws: WebSocket, err: Error) {
//       const userId = (ws as any)._userId;
//       console.error(`⚠️ WS error for ${userId}:`, err);
//     },
//   };
// }

export { upgradeWebSocket, websocket };
