import type { ServerWebSocket } from "bun";

type UserID = string;
type ConversationID = string;

export const onlineUsers = new Map<UserID, ServerWebSocket | undefined>();
export const conversationConnections = new Map<ConversationID, Set<UserID>>();

export function addUserConnection(
  userId: UserID,
  socket: ServerWebSocket | undefined
) {
  onlineUsers.set(userId, socket);
}

export function removeUserConnection(userId: UserID) {
  onlineUsers.delete(userId);
  for (const [convId, members] of conversationConnections.entries()) {
    members.delete(userId);
    if (members.size === 0) conversationConnections.delete(convId);
  }
}

export function joinConversation(
  conversationId: ConversationID,
  userId: UserID
) {
  if (!conversationConnections.has(conversationId)) {
    conversationConnections.set(conversationId, new Set());
  }
  conversationConnections.get(conversationId)!.add(userId);
}

export function getConversationUsers(conversationId: ConversationID): UserID[] {
  return Array.from(conversationConnections.get(conversationId) ?? []);
}

export function getUserSocket(userId: UserID): ServerWebSocket | undefined {
  return onlineUsers.get(userId);
}
