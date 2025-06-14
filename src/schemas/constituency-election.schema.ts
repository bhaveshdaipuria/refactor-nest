import mongoose from "mongoose";
// Election Candidate Schema with Index
export const ConstituencyElectionSchema = new mongoose.Schema({
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  constituency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Constituency",
    required: true,
  },
  status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
});
