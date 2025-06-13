# End-to-End Encrypted Chat Backend

A **full-stack end-to-end encrypted** messaging backend built with **Bun**, **Hono**, **Prisma** and **WebSockets**. Messages are encrypted entirely client-side, stored on the server as ciphertext, and delivered in real-time when recipients are online. Offline users fetch stored ciphertext via HTTP.

---

## 🚀 Features

- **End-to-End Encryption**: All plaintext is encrypted/decrypted in the browser with client-generated keypairs.
- **Real-Time Messaging**: WebSocket-based “push” delivery with HTTP fallback.
- **Persistent Storage**: Prisma + PostgreSQL stores only ciphertext.
- **Lightweight Framework**: Powered by Bun (v1.0+) and Hono for ultra-fast cold start and minimal overhead.
- **Auto-Reconnect & Offline Support**: Clients fetch missed messages on reconnect.
- **Extensible**: Conversation table, public-key exchange, read/delivered flags, retry/back-off for DB writes.

---

## 🗂️ Tech Stack

| Layer               | Technology                     |
| ------------------- | ------------------------------ |
| Runtime             | Bun                            |
| HTTP Framework      | Hono                           |
| WebSocket Helper    | `hono/bun`                     |
| ORM                 | Prisma (TypeScript client)     |
| Database            | PostgreSQL (e.g. Neon)         |
| Encryption (client) | libsodium-wrappers / tweetnacl |

---

## 📐 Architecture Overview

```mermaid
flowchart LR

  subgraph Client

    A[Key Generation & Storage]

    B[Encrypt / Decrypt Messages]

    C[WebSocket client]

    D[HTTP communication]

  end



  subgraph Server

    W[HTTP Routing]

    Z[Database Operations using Prisma + Postgres]

    X[In-Memory Maps : sockets and conversations]

    Y[WebSocket Handler]

  end



  A --> B
 
  D -->|Encrypted Message via HTTP POST| W
 
  B -->|Send encrypted message| C
 
  B -->|Send encrypted message| D
 
  C -->|Encrrypted message via WebSocket| Y
 
  Y -->|Response to Client| C

  C -->|HTTP POST| W

  W -->|Store or Retrieve messages| Z
 
  W -->|Store User Info/Auth| Z
 
  W -->|Query Result/ Response to Client| Z
 
  Y -->|Store or Retrieve messages|Z

  Y <-->|Bi-Directional lookup|X

  X <-->|Bi-Directional updates| Y
```

- **Key Exchange**: `/keys/:username` returns a user’s public key.
- **Conversations**: One-to-one chats stored in `Conversation` table (unique `(user1Id, user2Id)`).
- **Messages**: Stored in `Message` table with `(senderId, recipientId, conversationId, ciphertext, timestamp)`.

---

## ⚙️ Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/you/e2ee-backend.git
cd e2ee-backend
bun install
```

### 2. Environment

Create a `.env` in project root:

```dotenv
PORT=8080
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require"
```

> If using Neon, include `pooler` host and `?connect_timeout=15`.

### 3. Prisma Setup

```bash
# Initialize migrations (if first time)
bunx prisma migrate dev --name init

# Generate the client
bunx prisma generate
```

### 4. Run Dev Server

```bash
bun run dev
```

This uses your `package.json` script:

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts"
  }
}
```

---

## 🔌 HTTP API

| Route                       | Method | Body / Params                                           | Description                                                     |
| --------------------------- | ------ | ------------------------------------------------------- | --------------------------------------------------------------- |
| `/user/:username`           | GET    | URL param: `username`                                   | Fetch user `id`, `username`, `email`                            |
| `/user/signup`              | POST   | `{ email, password, publicKey, username }`              | Register new user (bcrypt-hashed)                               |
| `/user/signin`              | POST   | `{ emailOrUsername, password }`                         | Authenticate (returns basic user)                               |
| `/keys/:username`           | GET    | URL param: `username`                                   | Get public key for E2EE                                         |
| `/conversation/new`         | POST   | `{ user1Id, user2Id }`                                  | Create or fetch existing conversation; returns both public keys |
| `/message/send`             | POST   | `{ senderId, recipientId, conversationId, ciphertext }` | Store encrypted message                                         |
| `/messages/:conversationId` | GET    | URL param: `conversationId`                             | Fetch all messages in a conversation                            |

_All `/POST` routes validate with Zod + `hono/validator`._

---

## 💬 WebSocket Protocol

- **Endpoint**: `ws://HOST/ws?userId=<your-id>`
- **Query Param**: `userId` (UUID)
- **Message Types**:

  ```jsonc
  // Join a conversation
  { "type": "join", "conversationId": "abc123" }

  // Send encrypted message
  {
    "type": "message",
    "conversationId": "abc123",
    "recipientId": "user-456",
    "ciphertext": "BASE64..."
  }
  ```

- **Server Hooks**:

  - `onOpen(evt, ws)`: authenticate & `addUserConnection(userId, ws.raw)`
  - `onMessage(evt, ws)`: parse `evt.data`, forward if online, persist via `postMessageWithRetry()`
  - `onClose(evt, ws)`: `removeUserConnection(userId)`
  - `onError(evt, ws)`: log errors

**WebSocket Handler Integration**:

```ts
import { upgradeWebSocket, wsHandler } from "./ws/ws";
app.get("/ws", upgradeWebSocket(wsHandler));

export default {
  port: process.env.PORT,
  fetch: app.fetch,
  websocket, // provided by createBunWebSocket()
};
```

---

## 🛠️ Reliability & Retry

- **DB writes** use `postMessageWithRetry()` with exponential backoff (3 retries). (To Do)
- Un-persisted messages can be queued or alerted to the client.
- Offline users fetch missed messages via HTTP using Prisma’s `gt: timestamp` filter.

---

## 🔒 Security Considerations

- **E2EE**: All encryption happens on the client; server never sees plaintext.
- **Password hashing**: bcrypt with salt rounds = 10.
- **Rate limiting**: Add middleware for abuse prevention.
- **JWT**: Future improvement for stateless sessions.

---

## 📈 Next Steps

- **Multi-device** sync (key management + push notifications).
- **Group chats** (extend `Conversation` → many-to-many).
- **Read/Delivered receipts** (`delivered`, `read` flags on `Message`).
- **Media support**: binary over WebSocket, storage in R2/S3.
- **Video calls**: WebRTC signaling via `/ws`, TURN/STUN servers.

---

> Feel free to adapt and extend for your own projects!
