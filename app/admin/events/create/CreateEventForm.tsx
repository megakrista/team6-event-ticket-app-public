"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import FormField from "@/ui/components/FormField";
import { VALID_CATEGORIES } from "@/types/eventtype";
import { API_ROUTES } from "@/lib/api-routes";

type Venue = { id: string; name: string };

type FormState = {
  title: string;
  description: string;
  category: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  price: string;
  imageUrl: string;
};

const INITIAL_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  venueId: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  price: "",
  imageUrl: "",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildPayload(form: FormState) {
  return {
    title: form.title,
    description: form.description,
    category: form.category,
    venueId: form.venueId,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
    capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
    price: form.price ? parseFloat(form.price) : undefined,
    imageUrl: form.imageUrl || undefined,
  };
}

function isFormDirty(form: FormState): boolean {
  return Object.keys(INITIAL_FORM).some(
    (key) => form[key as keyof FormState] !== INITIAL_FORM[key as keyof FormState],
  );
}

export default function CreateEventForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    async function loadVenues() {
      try {
        const response = await fetch(API_ROUTES.venues);
        const data = await response.json();
        setVenues(data.venues ?? []);
      } catch {
        setError("Failed to load venues");
      } finally {
        setVenuesLoading(false);
      }
    }
    loadVenues();
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isFormDirty(form) && !success) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [form, success]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function blockNegativeKeys(e: React.KeyboardEvent) {
    if (e.key === "-" || e.key === "e" || e.key === "E") {
      e.preventDefault();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch(API_ROUTES.events, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
          const firstErrorKey = Object.keys(data.fields)[0];
          document.getElementById(firstErrorKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          setError(data.error ?? "Failed to create event");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      setSuccess({ id: data.event.id, title: data.event.title });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }

  const errorCount = Object.keys(fieldErrors).length;

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow">
        <div className="space-y-4 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Event &quot;{success.title}&quot; created successfully.</p>
          <p className="text-xs text-green-600">ID: {success.id}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              setSuccess(null);
              setForm(INITIAL_FORM);
            }}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Create another event
          </button>
          <Link
            href="/"
            className="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Create Event</h1>

      {error && <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {!venuesLoading && venues.length === 0 && !error && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No venues available. Run <code className="font-mono">npx prisma db seed</code> to create test venues.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Title"
          name="title"
          placeholder="e.g., Rock Summer Festival 2026"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          error={fieldErrors.title}
          required
        />

        <FormField
          as="textarea"
          label="Description"
          name="description"
          placeholder="Describe what attendees can expect..."
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          error={fieldErrors.description}
          charCount={form.description.length}
          maxLengthDisplay={5000}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField as="select" label="Category" name="category" value={form.category} onChange={(e) => handleChange("category", e.target.value)} error={fieldErrors.category} required>
            <option value="">Select category</option>
            {VALID_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{capitalize(cat)}</option>
            ))}
          </FormField>

          <FormField as="select" label="Venue" name="venueId" value={form.venueId} onChange={(e) => handleChange("venueId", e.target.value)} error={fieldErrors.venueId} required>
            {venuesLoading ? (
              <option value="">Loading venues...</option>
            ) : (
              <>
                <option value="">Select venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Start date & time"
            name="startsAt"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => handleChange("startsAt", e.target.value)}
            error={fieldErrors.startsAt}
            required
          />

          <FormField
            label="End date & time"
            name="endsAt"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => handleChange("endsAt", e.target.value)}
            error={fieldErrors.endsAt}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            placeholder="e.g., 500"
            value={form.capacity}
            onChange={(e) => handleChange("capacity", e.target.value)}
            onKeyDown={blockNegativeKeys}
            error={fieldErrors.capacity}
            required
          />

          <FormField
            label="Price (€)"
            name="price"
            type="number"
            min={0}
            step={0.01}
            placeholder="e.g., 25.00"
            value={form.price}
            onChange={(e) => handleChange("price", e.target.value)}
            onKeyDown={blockNegativeKeys}
            error={fieldErrors.price}
            required
          />
        </div>

        <div>
          <FormField
            label="Image URL"
            name="imageUrl"
            type="url"
            placeholder="https://example.com/image.jpg"
            value={form.imageUrl}
            onChange={(e) => handleChange("imageUrl", e.target.value)}
            error={fieldErrors.imageUrl}
          />
          {form.imageUrl && !fieldErrors.imageUrl && (
            <div className="mt-2">
              <img
                src={form.imageUrl}
                alt="Preview"
                className="h-24 w-24 rounded border border-zinc-200 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                onLoad={(e) => {
                  (e.target as HTMLImageElement).style.display = "block";
                }}
              />
            </div>
          )}
        </div>

        {errorCount > 0 && (
          <p className="text-sm text-red-600">
            {errorCount} {errorCount === 1 ? "field needs" : "fields need"} attention
          </p>
        )}

        <button
          type="submit"
          disabled={loading || (venues.length === 0 && !venuesLoading)}
          className="w-full rounded bg-blue-600 p-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating event..." : "Create event"}
        </button>
      </form>
    </div>
  );
}
