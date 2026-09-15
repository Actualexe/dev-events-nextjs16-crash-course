'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const MODES = ['online', 'offline', 'hybrid'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const emptyForm = {
    title: '',
    overview: '',
    description: '',
    venue: '',
    location: '',
    date: '',
    time: '',
    mode: 'online',
    audience: '',
    organizer: '',
};

type FormFields = typeof emptyForm;

const NewEventPage = () => {
    const router = useRouter();

    const [form, setForm] = useState<FormFields>(emptyForm);
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagDraft, setTagDraft] = useState('');
    const [agenda, setAgenda] = useState<string[]>(['']);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Object URLs leak until revoked, so tie each one to the file it previews.
    useEffect(() => {
        if (!image) return setPreview(null);

        const url = URL.createObjectURL(image);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [image]);

    const update = (field: keyof FormFields) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const addTag = () => {
        const tag = tagDraft.trim();

        if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
        setTagDraft('');
    };

    const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;

        if (file && !file.type.startsWith('image/')) {
            setError('That file is not an image.');
            return;
        }

        if (file && file.size > MAX_IMAGE_BYTES) {
            setError('Image must be 5MB or smaller.');
            return;
        }

        setError(null);
        setImage(file);
    };

    // Mirrors the requirements the Event schema enforces, so the user gets a
    // message instead of a 500 from Mongoose validation.
    const validate = (agendaItems: string[]) => {
        const missing = (Object.keys(emptyForm) as (keyof FormFields)[]).find(
            (field) => !form[field].trim()
        );

        if (missing) return `Please fill in the ${missing} field.`;
        if (!image) return 'Please choose a banner image.';
        if (tags.length === 0) return 'Add at least one tag.';
        if (agendaItems.length === 0) return 'Add at least one agenda item.';

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const agendaItems = agenda.map((item) => item.trim()).filter(Boolean);
        const problem = validate(agendaItems);

        if (problem) return setError(problem);

        setError(null);
        setSubmitting(true);

        try {
            const body = new FormData();

            Object.entries(form).forEach(([field, value]) => body.append(field, value));
            body.append('image', image!);
            // The API expects these two as JSON-encoded strings inside the form data.
            body.append('tags', JSON.stringify(tags));
            body.append('agenda', JSON.stringify(agendaItems));

            const response = await fetch('/api/events', { method: 'POST', body });
            const data = await response.json();

            if (!response.ok) {
                setError(data.message ?? 'Could not create the event.');
                return;
            }

            router.push(`/events/${data.event.slug}`);
        } catch {
            setError('Could not reach the server. Check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section id="new-event">
            <div className="header">
                <h1>Create an Event</h1>
                <p>Share your hackathon, meetup, or conference with the community.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                    <label htmlFor="title">Title</label>
                    <input id="title" value={form.title} onChange={update('title')}
                           maxLength={100} placeholder="React Summit 2026" />
                    <span className="hint">The URL is generated from this, so it must be unique.</span>
                </div>

                <div className="field">
                    <label htmlFor="overview">Overview</label>
                    <textarea id="overview" value={form.overview} onChange={update('overview')}
                              maxLength={500} rows={3} placeholder="A short summary shown near the top of the page" />
                    <span className="hint">{form.overview.length}/500</span>
                </div>

                <div className="field">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" value={form.description} onChange={update('description')}
                              maxLength={1000} rows={5} placeholder="The full pitch for your event" />
                    <span className="hint">{form.description.length}/1000</span>
                </div>

                <div className="field">
                    <label htmlFor="image">Banner image</label>
                    <input id="image" type="file" accept="image/*" onChange={handleImage} />
                    {preview && (
                        <Image src={preview} alt="Selected banner preview" width={800} height={300}
                               unoptimized className="preview" />
                    )}
                </div>

                <div className="row">
                    <div className="field">
                        <label htmlFor="date">Date</label>
                        <input id="date" type="date" value={form.date} onChange={update('date')} />
                    </div>

                    <div className="field">
                        <label htmlFor="time">Time</label>
                        <input id="time" type="time" value={form.time} onChange={update('time')} />
                    </div>
                </div>

                <div className="row">
                    <div className="field">
                        <label htmlFor="venue">Venue</label>
                        <input id="venue" value={form.venue} onChange={update('venue')}
                               placeholder="Moscone Center" />
                    </div>

                    <div className="field">
                        <label htmlFor="location">Location</label>
                        <input id="location" value={form.location} onChange={update('location')}
                               placeholder="San Francisco, CA, USA" />
                    </div>
                </div>

                <div className="row">
                    <div className="field">
                        <label htmlFor="mode">Mode</label>
                        <select id="mode" value={form.mode} onChange={update('mode')}>
                            {MODES.map((mode) => (
                                <option key={mode} value={mode}>{mode}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="audience">Audience</label>
                        <input id="audience" value={form.audience} onChange={update('audience')}
                               placeholder="Frontend engineers" />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="organizer">Organizer</label>
                    <input id="organizer" value={form.organizer} onChange={update('organizer')}
                           placeholder="Who is running this event?" />
                </div>

                <div className="field">
                    <label htmlFor="tag-draft">Tags</label>
                    <div className="chip-input">
                        <input
                            id="tag-draft"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                    // Enter would otherwise submit the whole form.
                                    e.preventDefault();
                                    addTag();
                                }
                            }}
                            placeholder="Type a tag and press Enter"
                        />
                        <button type="button" onClick={addTag} className="secondary">Add</button>
                    </div>

                    {tags.length > 0 && (
                        <div className="chips">
                            {tags.map((tag) => (
                                <span key={tag} className="pill">
                                    {tag}
                                    <button type="button" aria-label={`Remove ${tag}`}
                                            onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <span className="hint">Events sharing a tag are suggested to each other.</span>
                </div>

                <div className="field">
                    <label>Agenda</label>
                    {agenda.map((item, index) => (
                        <div className="chip-input" key={index}>
                            <input
                                value={item}
                                onChange={(e) => setAgenda((prev) =>
                                    prev.map((value, i) => (i === index ? e.target.value : value))
                                )}
                                placeholder={`Item ${index + 1} — e.g. 09:00 Registration`}
                            />
                            {agenda.length > 1 && (
                                <button type="button" className="secondary" aria-label={`Remove item ${index + 1}`}
                                        onClick={() => setAgenda((prev) => prev.filter((_, i) => i !== index))}>
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" className="secondary w-fit"
                            onClick={() => setAgenda((prev) => [...prev, ''])}>
                        + Add agenda item
                    </button>
                </div>

                {error && <p className="error" role="alert">{error}</p>}

                <button type="submit" className="submit" disabled={submitting}>
                    {submitting ? 'Creating…' : 'Create Event'}
                </button>
            </form>
        </section>
    );
};

export default NewEventPage;
