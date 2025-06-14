import mongoose from "mongoose";

export const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    allowedConstituencies: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Constituency",
      validate: {
        validator: function (value: "user") {
          return this.role === "user" || !value || value.length === 0;
        },
        message: "Only users can have allowedConstituencies",
      },
    },
  },
  { timestamps: true },
);
