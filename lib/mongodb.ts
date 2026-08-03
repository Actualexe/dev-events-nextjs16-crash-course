import mongoose, { Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Please define it in your .env file."
  );
}

// Shape of the cached connection object stored on the global object.
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Augment the NodeJS global type so TypeScript knows about our cache.
// Next.js hot-reloads modules in development, which would otherwise create
// a new connection on every reload; caching on `global` survives reloads.
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Reuse an existing cache if one exists, otherwise initialize a fresh one.
const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connects to MongoDB using Mongoose, reusing a cached connection/promise
 * across invocations to avoid exhausting connections in development
 * (hot reload) and serverless environments (concurrent function calls).
 */
export async function connectToDatabase(): Promise<Mongoose> {
  // If a connection already exists, return it immediately.
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is in progress, wait for it instead of starting a new one.
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset the promise on failure so the next call can retry the connection.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectToDatabase;
