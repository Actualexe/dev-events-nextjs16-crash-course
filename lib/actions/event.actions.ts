'use server';

import Event, { PlainEvent } from '@/database/event.model';
import connectDB from "@/lib/mongodb";

// `.lean()` results still contain ObjectId and Date instances. Round-tripping
// through JSON turns them into plain strings so the result can be cached and
// handed to Client Components.
const toPlain = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

export const getAllEvents = async (): Promise<PlainEvent[]> => {
    try {
        await connectDB();

        return toPlain<PlainEvent[]>(await Event.find().sort({ createdAt: -1 }).lean());
    } catch (e) {
        console.error('Failed to load events', e);
        return [];
    }
}

export const getEventBySlug = async (slug: string): Promise<PlainEvent | null> => {
    try {
        await connectDB();

        const event = await Event.findOne({ slug: slug.trim().toLowerCase() }).lean();

        return event ? toPlain<PlainEvent>(event) : null;
    } catch (e) {
        console.error(`Failed to load event '${slug}'`, e);
        return null;
    }
}

/**
 * Events to show alongside the one being viewed.
 *
 * Events that share a tag come first. If there aren't enough of those, the list
 * is topped up with the most recent other events — otherwise a catalogue with
 * no tag overlap renders a heading above an empty grid.
 *
 * Takes the id and tags directly rather than a slug, since the caller has
 * already loaded the event and re-querying it would be a wasted round trip.
 */
export const getSimilarEvents = async (
    { id, tags, limit = 3 }: { id: string; tags: string[]; limit?: number }
): Promise<PlainEvent[]> => {
    try {
        await connectDB();

        const byTag = await Event.find({ _id: { $ne: id }, tags: { $in: tags } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        if (byTag.length >= limit) return toPlain<PlainEvent[]>(byTag);

        const exclude = [id, ...byTag.map((event) => String(event._id))];
        const recent = await Event.find({ _id: { $nin: exclude } })
            .sort({ createdAt: -1 })
            .limit(limit - byTag.length)
            .lean();

        return toPlain<PlainEvent[]>([...byTag, ...recent]);
    } catch (e) {
        console.error(`Failed to load events similar to '${id}'`, e);
        return [];
    }
}
