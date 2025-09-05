//controllers/messageController.js
import mongoose from "mongoose";
import Chat from "../models/Chat.js"; // assuming Chat model exists
import Message from "../models/Message.js";

// ✅ Send message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, receiver, text } = req.body;
    if (!chatId || !receiver || !text) {
      return res.status(400).json({ message: "chatId, receiver, and text are required" });
    }

    const message = await Message.create({
      chatId,
      sender: req.user._id,
      receiver,
      text,
    });

    // Update chat's lastMessage & timestamp
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: text,
      updatedAt: new Date(),
    });

    // Emit via socket.io
    req.io.to(receiver.toString()).emit("newMessage", message);

    res.status(201).json(message);
  } catch (err) {
    console.error("Send Message Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Get messages for a chat
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const messages = await Message.find({ chatId })
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get Messages Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Mark messages as seen
export const markAsSeen = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const result = await Message.updateMany(
      { chatId, receiver: userId, seen: false },
      { $set: { seen: true } }
    );

    res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error("Mark As Seen Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
