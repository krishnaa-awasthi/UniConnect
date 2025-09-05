import express from "express";
import Chat from "../models/Chat.js";
import mongoose from "mongoose";
import Message from "../models/Message.js";

const router = express.Router();

// ✅ Create or get chat between two users
router.post("/", async (req, res) => {
  const { userId1, userId2 } = req.body;
  if (!userId1 || !userId2) {
    return res.status(400).json({ message: "Both user IDs are required." });
  }
  try {
    let chat = await Chat.findOne({
      participants: { $all: [userId1, userId2] },
    }).populate("participants", "username profilePic");

    if (!chat) {
      chat = new Chat({ participants: [userId1, userId2] });
      await chat.save();
      chat = await chat.populate("participants", "username profilePic");
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error creating or fetching chat:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all chats for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID." });
  }
  try {
    const chats = await Chat.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .populate("participants", "username profilePic");

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
