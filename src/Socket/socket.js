// src/Socket/socket.js
import ChatRoom from "../models/chat.model.js";
import Message from "../models/message.model.js";
import { onlineUsers } from "./socketManager.js";

export function RegisterSocket(io) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    let currentUserId = null;

    // 1. Register user
    socket.on("register", ({ userId }) => {
      if (!userId) return;

      currentUserId = userId.toString();

      if (!onlineUsers.has(currentUserId)) {
        onlineUsers.set(currentUserId, new Set());
      }
      onlineUsers.get(currentUserId).add(socket.id);

      console.log(`User ${currentUserId} is online (socket: ${socket.id})`);
      socket.broadcast.emit("userOnlineStatus", { userId: currentUserId, status: "online" });
    });

    // 2. Join or create room
    socket.on("joinRoom", async ({ roomId, userId, participants }) => {
      try {
        let room;

        if (roomId) {
          room = await ChatRoom.findById(roomId);
          if (!room) {
            return socket.emit("error", { message: "Room not found" });
          }
        } else if (participants && participants.length >= 2) {
          const sorted = participants.map(id => id.toString()).sort();
          room = await ChatRoom.findOne({
            participants: { $all: sorted, $size: sorted.length },
            isGroup: false, // optional: only match 1-on-1 chats
          });

          if (!room) {
            room = await ChatRoom.create({
              participants: sorted,
              isGroup: false,
            });
            console.log("Created new chat room:", room._id);
          }
        } else {
          return socket.emit("error", { message: "Invalid participants" });
        }

        const roomIdStr = room._id.toString();
        socket.join(roomIdStr);

        socket.emit("roomJoined", {
          roomId: roomIdStr,
          participants: room.participants,
        });

        console.log(`User ${userId} joined room ${roomIdStr}`);
      } catch (err) {
        console.error("joinRoom error:", err);
        socket.emit("error", { message: "Failed to join/create room" });
      }
    });

    // 3. FIXED chatMessage — NO MORE NULL CRASH
    socket.on("chatMessage", async ({ roomId, userId, message: content }) => {
      if (!roomId || !userId || !content?.trim()) {
        console.warn("Invalid chatMessage payload:", { roomId, userId, content });
        return;
      }

      try {
        // 1. Verify room exists
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          console.log("chatMessage: Room not found →", roomId);
          return socket.emit("error", { message: "Chat room does not exist" });
        }

        // 2. Find recipient (for 1-on-1 chat)
        const recipientId = room.participants
          .find(id => id.toString() !== userId.toString());

        const isRecipientOnline = recipientId && onlineUsers.has(recipientId.toString());

        // 3. Create message
        const msg = await Message.create({
          roomId,
          senderId: userId,
          message: content,
          status: isRecipientOnline ? "delivered" : "sent",
        });

        const populatedMsg = await Message.findById(msg._id)
          .populate("senderId", "name avatar image");

        const messageData = {
          _id: populatedMsg._id,
          roomId: populatedMsg.roomId,
          senderId: populatedMsg.senderId._id,
          sender: populatedMsg.senderId, // full sender object
          message: populatedMsg.message,
          status: populatedMsg.status,
          createdAt: populatedMsg.createdAt,
        };

        // 4. Emit to entire room
        io.to(roomId.toString()).emit("chatMessage", messageData);

        console.log(`Message sent in room ${roomId} by ${userId} → status: ${msg.status}`);
      } catch (err) {
        console.error("chatMessage error:", err.message);
      }
    });

    // 4. Mark messages as read
    socket.on("markAsRead", async ({ roomId, userId }) => {
      try {
        await Message.updateMany(
          {
            roomId,
            senderId: { $ne: userId },
            status: { $in: ["sent", "delivered"] },
          },
          { $set: { status: "read" } }
        );

        io.to(roomId.toString()).emit("messagesRead", { roomId, readerId: userId });
      } catch (err) {
        console.error("markAsRead error:", err);
      }
    });

    // 5. Handle disconnect properly
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      if (currentUserId && onlineUsers.has(currentUserId)) {
        const userSockets = onlineUsers.get(currentUserId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(currentUserId);
          console.log(`User ${currentUserId} is now offline`);
          socket.broadcast.emit("userOnlineStatus", {
            userId: currentUserId,
            status: "offline",
          });
        }
      }
    });
  });
}