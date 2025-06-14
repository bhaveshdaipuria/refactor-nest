import mongoose from "mongoose";

export const allianceSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	logo: { type: String, required: true, unique: true },
	leaderParty: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
	parties: [{ type: mongoose.Schema.Types.ObjectId, ref: "Party" }],
	election: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "TempElection",
		required: true,
	},
});

