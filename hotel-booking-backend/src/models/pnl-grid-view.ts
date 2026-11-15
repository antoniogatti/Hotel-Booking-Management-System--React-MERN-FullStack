import mongoose from "mongoose";

const colorTagSchema = new mongoose.Schema(
  { id: { type: String, required: true }, name: { type: String, required: true }, color: { type: String, required: true } },
  { _id: false }
);

const pnlGridViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    columns: { type: [String], required: true },
    hiddenGroups: { type: [String], required: true },
    frozenColumns: { type: Number, required: true },
    widths: { type: mongoose.Schema.Types.Mixed, required: true },
    colorTags: { type: [colorTagSchema], default: [] },
    columnColors: { type: mongoose.Schema.Types.Mixed, default: {} },
    colorFilter: { type: String, default: "" },
    columnFilters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false, autoCreate: false, autoIndex: false }
);

export default mongoose.model("PnlGridView", pnlGridViewSchema);
