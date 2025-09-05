// backend/models/User.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, maxlength: 1000, default: "" },
    image: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    collegeId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 30 },
    bio: { type: String, maxlength: 500, default: "" },
    profilePic: { type: String, default: "" },
    coverPic: { type: String, default: "" },
    posts: [postSchema],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
