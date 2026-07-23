import mongoose, { type Document, Schema } from "mongoose";

export interface IArticle extends Document {
	title: string;
	sourceUrl: string;
	topicCategory: string;
	summary: string[];
	status: "PENDING" | "APPROVED" | "REJECTED";
	runDate: string; // Format: YYYY-MM-DD
	createdAt: Date;
	updatedAt: Date;
}

const ArticleSchema: Schema = new Schema(
	{
		title: { type: String, required: true },
		sourceUrl: { type: String, required: true, unique: true },
		topicCategory: { type: String, required: true },
		summary: { type: [String], required: true },
		status: {
			type: String,
			enum: ["PENDING", "APPROVED", "REJECTED"],
			default: "PENDING",
		},
		runDate: { type: String, required: true, index: true },
	},
	{
		timestamps: true, // Automatically manages createdAt and updatedAt
	},
);

export default mongoose.model<IArticle>("Article", ArticleSchema);
