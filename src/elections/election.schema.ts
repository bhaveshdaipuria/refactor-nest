import { Schema, Types } from 'mongoose';

const ElectionInfoSchema = new Schema({
  partyIds: [{ type: Types.ObjectId, ref: 'Party' }],
  candidates: [{ type: Types.ObjectId, ref: 'Candidate' }],
});

export const ElectionSchema = new Schema(
  {
    state: {
      type: String,
      required: [true, 'State name is required'],
      trim: true,
    },
    electionSlug: {
      type: String,
      required: [true, 'State slug is required'],
    },
    totalSeats: {
      type: Number,
      required: [true, 'Total seats count is required'],
      min: [1, 'There should be at least 1 seat'],
    },
    electionType: {
      type: String,
      enum: ['assembly', 'general'],
      required: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    halfWayMark: {
      type: Number,
      required: [true, 'Halfway mark is required'],
      min: [0, 'Halfway mark cannot be negative'],
    },
    electionInfo: {
      type: ElectionInfoSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['ongoing', 'completed', 'upcoming'],
      default: 'upcoming',
    },
  },
  { timestamps: true },
);
