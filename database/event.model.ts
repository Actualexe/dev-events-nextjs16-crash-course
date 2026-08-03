import { Schema, model, models, type Model, type Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    mode: { type: String, required: true, trim: true },
    audience: { type: String, required: true, trim: true },
    agenda: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: "Agenda must contain at least one item.",
      },
    },
    organizer: { type: String, required: true, trim: true },
    tags: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: "Tags must contain at least one item.",
      },
    },
  },
  { timestamps: true }
);

// Generates a URL-friendly slug from a title (lowercase, hyphenated, no special chars).
function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Normalizes free-form time input (e.g. "9:0 AM") to a consistent "HH:MM AM/PM" format.
function normalizeTime(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (!match) {
    throw new Error(`Invalid time format: "${time}". Expected "HH:MM AM/PM".`);
  }
  const [, hours, minutes, meridiem] = match;
  return `${hours.padStart(2, "0")}:${minutes} ${meridiem.toUpperCase()}`;
}

eventSchema.pre("save", function () {
  // Only regenerate the slug when the title is new or has changed.
  if (this.isModified("title")) {
    this.slug = slugify(this.title);
  }

  // Normalize the date to ISO format (YYYY-MM-DD) for consistent storage/sorting.
  const parsedDate = new Date(this.date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date value: "${this.date}".`);
  }
  this.date = parsedDate.toISOString().split("T")[0];

  // Normalize time to a single consistent format.
  this.time = normalizeTime(this.time);
});

export const Event: Model<IEvent> = models.Event || model<IEvent>("Event", eventSchema);
