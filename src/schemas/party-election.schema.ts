import { Schema } from "mongoose";

export const ElectionPartyResultSchema = new Schema({
  election: { type: Schema.Types.ObjectId, ref: "Election", required: true },
  party: { type: Schema.Types.ObjectId, ref: "Party", required: true },
  seatsWon: { type: Number, default: 0 },
});
