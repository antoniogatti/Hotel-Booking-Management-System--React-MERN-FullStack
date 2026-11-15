import mongoose from "mongoose";

const pnlGridViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    columns: { type: [String], required: true },
    hiddenGroups: { type: [String], required: true },
    frozenColumns: { type: Number, required: true },
    widths: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false, autoCreate: false, autoIndex: false }
);

export default mongoose.model("PnlGridView", pnlGridViewSchema);
