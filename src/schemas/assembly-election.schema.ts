import mongoose from "mongoose";

export const electionSchema = new mongoose.Schema({
	year: { type: String, required: true, unique: true },
	state: { type: String, required: true, unique: true },
	total_seat: { type: Number, required: true },
	total_votes: { type: String, required: true },
	total_candidate: { type: Number, required: true },
	constituencies: [
		{ type: mongoose.Schema.Types.ObjectId, ref: "Constituency" },
	],
});
