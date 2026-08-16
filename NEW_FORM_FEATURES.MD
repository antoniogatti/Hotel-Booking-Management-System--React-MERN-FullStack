Self Check-In - Final Implementation Specification

Status: Ready for implementation after this spec.

1) Confirmed Product Rules
- Source code input: use only the query parameter `q`.
- If `q` is present: generate and return 4-digit confirmation code (code can repeat).
- If `q` is missing: do not return confirmation code; frontend shows embedded YouTube instruction video.
- Minimum guests: 1.
- Maximum guests: 4.
- Breakfast time allowed range: 08:30 to 10:00.
- Guest document types allowed: `id_card`, `passport`.
- CAPTCHA: use Cloudflare Turnstile (same pattern as contact form).
- Admin email recipient: `info@palazzopintobnb.com`.
- No DB migration required.

2) Data Model (MongoDB + Mongoose)
- Use dedicated collection: `selfcheckins`.
- Top-level identifies the main check-in and source info.
- All guests are linked as nested subdocuments in `guests[]`.
- Guest uploaded files are stored in MongoDB via GridFS and linked by ObjectId.

Suggested schema:

```ts
import mongoose from "mongoose";

const GuestDocumentRefSchema = new mongoose.Schema(
  {
    gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GuestSchema = new mongoose.Schema(
  {
    givenName: { type: String, required: true, trim: true },
    familyName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ["id_card", "passport"],
      required: true,
    },
    documentNumber: { type: String, required: true, trim: true },
    breakfastChoice: {
      type: String,
      enum: ["Savoury", "Sweet"],
      required: true,
    },
    documents: {
      type: [GuestDocumentRefSchema],
      default: [],
    },
  },
  { _id: false }
);

const SelfCheckinSchema = new mongoose.Schema(
  {
    // Main check-in identity (top-level)
    fullName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ["id_card", "passport"],
      required: true,
    },
    documentNumber: { type: String, required: true, trim: true },

    numberOfNights: { type: Number, required: true, min: 1 },
    breakfastTime: { type: String, required: true }, // validated as HH:mm and range 08:30-10:00

    guests: {
      type: [GuestSchema],
      validate: [
        {
          validator: (v: unknown[]) => Array.isArray(v) && v.length >= 1 && v.length <= 4,
          message: "Guests must be between 1 and 4",
        },
      ],
      required: true,
    },

    sourceCode: { type: String, index: true }, // from query param q
    code: { type: String }, // 4-digit confirmation code only when q exists

    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

SelfCheckinSchema.index({ createdAt: -1 });
SelfCheckinSchema.index({ sourceCode: 1, createdAt: -1 });

export default mongoose.model("SelfCheckin", SelfCheckinSchema);
```

3) File Storage in MongoDB (How)
Use MongoDB GridFS for uploaded images/PDF files.

- Accept only MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/pdf`
- For each uploaded file:
  - stream file into GridFS bucket (for example: `selfcheckin_files`)
  - capture returned file `_id`
  - append reference in `guests[i].documents[]`

GridFS flow (concept):
1. Validate file type/size.
2. `bucket.openUploadStream(filename, { contentType })`.
3. Pipe upload buffer/stream to GridFS.
4. Save `{ gridFsId, filename, mimeType, size, uploadedAt }` in guest document refs.

4) API Requirements
POST `/api/self-checkin`
- Input source code: read only `req.query.q`.
- Required top-level fields:
  - `fullName`
  - `documentType` (`id_card|passport`)
  - `documentNumber`
  - `numberOfNights` (>0)
  - `breakfastTime` (08:30-10:00)
  - `guests` (1..4)
- Required per guest:
  - `givenName`
  - `familyName`
  - `documentType` (`id_card|passport`)
  - `documentNumber`
  - `breakfastChoice` (`Savoury|Sweet`)
- CAPTCHA:
  - verify Cloudflare Turnstile token using `TURNSTILE_SECRET`
  - same server-side verification pattern used by contact form
- Rate limiting:
  - per IP on `/api/self-checkin`
  - env-configurable: `SELF_CHECKIN_RATE_LIMIT`
- Response:
  - if `q` present: `{ id, code }`
  - if `q` missing: `{ id, instructionVideoUrl }`

5) Admin and Notifications
- Admin list page: `/admin/self-checkins` (table view of all submissions).
- Admin details page: `/admin/self-checkins/:id` (all fields + linked guest files).
- Email on submit:
  - recipient: `info@palazzopintobnb.com`
  - format: HTML
  - include: primary guest data, all guests, breakfast time, breakfast types, and admin link to record
  - do not include YouTube link in admin email

6) Frontend UX Requirements (Mobile First)
- Route: `/self-checkin`
- Linear single-column mobile flow.
- Guest repeater (add/remove) with hard cap of 4 guests.
- For each guest, file upload should be easy on mobile:
  - input accepts images and PDFs
  - mobile should allow camera capture for images
- If `q` missing on confirmation view: embed the YouTube instruction video.
- If `q` present: show styled confirmation with generated 4-digit code.

7) Environment Variables
Required additions in env files:
- `TURNSTILE_SECRET=...`
- `SELF_CHECKIN_RATE_LIMIT=20`
- `SELF_CHECKIN_INSTRUCTION_VIDEO_URL=https://www.youtube.com/watch?v=PRb5yw89zxw`
- `CONTACT_MAIL_INBOX=info@palazzopintobnb.com`
- `CONTACT_MAIL_SENDER=info@palazzopintobnb.com`

8) Out of Scope (Confirmed)
- No migration script.
- No data retention/auto-delete policy for now.
- No collision check for confirmation code.

9) Implementation Checklist
- Create/adjust dedicated `SelfCheckin` Mongoose schema as above.
- Implement GridFS storage and file-reference linking per guest.
- Enforce Turnstile verification (contact-form pattern).
- Validate all required fields and enums.
- Enforce 1..4 guest limit.
- Enforce breakfast time range.
- Implement q-only behavior and response branching.
- Build admin list/details pages.
- Send HTML admin email to `info@palazzopintobnb.com`.
- Add/update env documentation.
