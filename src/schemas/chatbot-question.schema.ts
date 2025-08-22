import mongoose from "mongoose";

export const chatbotQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  embedding: { type: [Number], required: true },
  answer: { type: String, required: true },
});
