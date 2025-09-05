import express from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const router = express.Router();

// ✅ Get messages for a chat
router.get("/:chatId", async (req, res) => {
  const { chatId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: "Invalid chat ID." });
  }
  try {
    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .populate("sender", "username profilePic");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Send a new message
router.post("/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { senderId, receiverId, text } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(senderId)) {
    return res.status(400).json({ message: "Invalid chat ID or sender ID." });
  }
  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "Message text cannot be empty." });
  }

  try {
    const newMessage = new Message({
      chatId,
      sender: senderId,
      receiver: receiverId,
      text,
    });

    await newMessage.save();

    // ✅ update lastMessage in chat
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: text,
      updatedAt: Date.now(),
    });

    const populatedMessage = await newMessage.populate("sender", "username profilePic");

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
