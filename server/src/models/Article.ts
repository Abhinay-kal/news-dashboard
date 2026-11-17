import mongoose, { type Document, Schema } from "mongoose";

export interface IArticle extends Document {
	title: string;
	sourceUrl: string;
	topicCategory: string;
	summary: string[];
	status: "PENDING" | "APPROVED" | "REJECTED";
	postStatus: "PENDING" | "POSTED" | "NOT_POSTED";
	assignedTo?: string; // Stores the email of the assigned writer
	runDate: string; // Format: YYYY-MM-DD
	thumbnailUrl?: string; // For YouTube videos and other media
	storyId?: string;
	urgencyScore?: number;
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
		postStatus: {
			type: String,
			enum: ["PENDING", "POSTED", "NOT_POSTED"],
			default: "PENDING",
		},
		assignedTo: { type: String, required: false },
		runDate: { type: String, required: true, index: true },
		thumbnailUrl: { type: String, required: false },
		storyId: { type: String },
		urgencyScore: { type: Number, default: 0 },
	},
	{
		timestamps: true, // Automatically manages createdAt and updatedAt
	},
);

export default mongoose.model<IArticle>("Article", ArticleSchema);
