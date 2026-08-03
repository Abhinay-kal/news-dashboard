import mongoose, { type Document } from "mongoose";
export interface IArticle extends Document {
    title: string;
    sourceUrl: string;
    topicCategory: string;
    summary: string[];
    status: "PENDING" | "APPROVED" | "REJECTED";
    postStatus: "PENDING" | "POSTED" | "NOT_POSTED";
    assignedTo?: string;
    runDate: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IArticle, {}, {}, {}, Document<unknown, {}, IArticle, {}, mongoose.DefaultSchemaOptions> & IArticle & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IArticle>;
export default _default;
//# sourceMappingURL=Article.d.ts.map