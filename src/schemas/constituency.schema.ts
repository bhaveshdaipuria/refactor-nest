import mongoose from "mongoose";

export const constituencySchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	state: { type: String, required: true },
	constituencyId: { type: Number, required: true },
	candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }],
});
