// models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    content: { 
      type: String, 
      trim: true, 
      required: true 
    },

    image: { 
      type: String, // store image URL or path (can integrate with S3, Cloudinary, etc.)
    },

    likes: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      }
    ],

    // For social media-like features
    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },

  },
  { timestamps: true } // auto createdAt & updatedAt
);

export default mongoose.model("Post", postSchema);
