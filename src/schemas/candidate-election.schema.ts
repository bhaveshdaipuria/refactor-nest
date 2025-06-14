import { Schema } from "mongoose";

export const ElectionCandidateSchema = new Schema({
  election: {
    type: Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  candidate: {
    type: Schema.Types.ObjectId,
    ref: "Candidate",
    required: true,
  },
  constituency: {
    type: Schema.Types.ObjectId,
    ref: "Constituency",
    required: true,
  },
  votesReceived: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["Won", "Lost", "Winning", "Trailing"],
  },
});
