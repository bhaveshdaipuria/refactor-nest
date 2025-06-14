// src/schemas/election.schema.ts

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

@Schema({ timestamps: true })
export class SubParty extends Document {
  @Prop({
    type: String,
    required: [true, "Party name is required"],
    trim: true,
  })
  name: string;

  @Prop({
    type: Number,
    required: [true, "Number of seats won is required"],
    min: [0, "Seats won cannot be negative"],
    default: 0,
  })
  won: number;

  @Prop({
    type: Number,
    min: [0, "Seats leading cannot be negative"],
    default: 0,
  })
  leading: number;

  @Prop({ type: String })
  partyColor: string;
}

export const SubPartySchema = SchemaFactory.createForClass(SubParty);

@Schema({ timestamps: true })
export class Party extends Document {
  @Prop({
    type: String,
    required: [true, "Party name is required"],
    trim: true,
  })
  name: string;

  @Prop({
    type: Number,
    required: [true, "Number of seats won is required"],
    min: [0, "Seats won cannot be negative"],
    default: 0,
  })
  won: number;

  @Prop({
    type: Number,
    min: [0, "Seats leading cannot be negative"],
    default: 0,
  })
  leading: number;

  @Prop({ type: String })
  partyColor: string;

  @Prop({ type: [SubPartySchema], default: [] })
  subParties: SubParty[];
}

export const PartySchema = SchemaFactory.createForClass(Party);

@Schema({ timestamps: true })
export class Election extends Document {
  @Prop({
    type: String,
    required: [true, "State name is required"],
    trim: true,
  })
  state: string;

  @Prop({
    type: String,
    required: [true, "State slug is required"],
    trim: true,
  })
  stateSlug: string;

  @Prop({
    type: Number,
    required: [true, "Total seats count is required"],
    min: [1, "There should be at least 1 seat"],
  })
  totalSeats: number;

  @Prop({
    type: Number,
    required: [true, "Declared seats count is required"],
    min: [0, "Declared seats cannot be negative"],
  })
  declaredSeats: number;

  @Prop({
    type: Number,
    required: [true, "Halfway mark is required"],
    min: [0, "Halfway mark cannot be negative"],
  })
  halfWayMark: number;

  @Prop({
    type: [PartySchema],
    validate: {
      validator: (v: Party[]) => v.length > 0,
      message: "At least one party must be provided",
    },
  })
  parties: Party[];

  // Virtual property
  totalWonSeats: number;
}

export const ElectionSchema = SchemaFactory.createForClass(Election);

// Add virtuals and methods to the schema
ElectionSchema.virtual("totalWonSeats").get(function (this: Election) {
  return this.parties.reduce((acc, party) => acc + party.won, 0);
});

ElectionSchema.methods.findLeadingParty = function (this: Election) {
  return this.parties.reduce((prev, current) => {
    return prev.won > current.won ? prev : current;
  });
};

ElectionSchema.statics.findByState = function (state: string) {
  return this.findOne({ state });
};

// Pre-save hook
ElectionSchema.pre<Election>("save", function (next) {
  if (this.parties) {
    this.parties.forEach((party) => {
      if (party.subParties && party.subParties.length > 0) {
        party.won = party.subParties.reduce(
          (acc, subParty) => acc + subParty.won,
          0,
        );
        party.leading = party.subParties.reduce(
          (acc, subParty) => acc + subParty.leading,
          0,
        );
      }
    });

    this.declaredSeats = this.parties.reduce(
      (acc, party) => acc + party.won,
      0,
    );
  }
  next();
});

// Pre-findOneAndUpdate hook
ElectionSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  if (update.parties) {
    update.parties.forEach((party: any) => {
      if (party.subParties && party.subParties.length > 0) {
        party.won = party.subParties.reduce(
          (acc: number, subParty: any) => acc + subParty.won,
          0,
        );
        party.leading = party.subParties.reduce(
          (acc: number, subParty: any) => acc + subParty.leading,
          0,
        );
      }
    });

    update.declaredSeats = update.parties.reduce(
      (acc: number, party: any) => acc + (party.won + party.leading),
      0,
    );
    this.setUpdate(update);
  }
  next();
});

export type ElectionDocument = Election & Document;
