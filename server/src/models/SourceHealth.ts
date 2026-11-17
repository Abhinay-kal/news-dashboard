import mongoose, { type Document, Schema } from "mongoose";

export interface ISourceHealth extends Document {
	feedUrl: string;
	lastSuccessfulPull: Date;
	consecutiveErrors: number;
	status: "HEALTHY" | "DEGRADED" | "DEAD";
	createdAt: Date;
	updatedAt: Date;
}

const SourceHealthSchema: Schema = new Schema(
	{
		feedUrl: { type: String, required: true, unique: true },
		lastSuccessfulPull: { type: Date, default: null },
		consecutiveErrors: { type: Number, default: 0 },
		status: {
			type: String,
			enum: ["HEALTHY", "DEGRADED", "DEAD"],
			default: "HEALTHY",
		},
	},
	{
		timestamps: true,
	},
);

export default mongoose.model<ISourceHealth>("SourceHealth", SourceHealthSchema);
