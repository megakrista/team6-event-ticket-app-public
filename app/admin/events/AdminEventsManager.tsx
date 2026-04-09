"use client";

import { FormEvent, type KeyboardEvent, useState } from "react";
import Link from "next/link";
import { API_ROUTES } from "@/lib/api-routes";
import { capitalize, formatDateTime, formatPrice } from "@/lib/format-helpers";
import { VALID_CATEGORIES } from "@/types/eventtype";
import FormField from "@/ui/components/FormField";

const STATUS_OPTIONS = ["DRAFT", "PUBLISHED"] as const;
type EditableStatus = (typeof STATUS_OPTIONS)[number];

export type AdminEventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  price: number;
  imageUrl: string | null;
  status: string;
  venueId: string;
  venueName: string;
};

export type AdminVenueOption = {
  id: string;
  name: string;
};

type AdminEventsManagerProps = {
  initialEvents: AdminEventItem[];
  venues: AdminVenueOption[];
};

type EditFormState = {
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

type ApiEventPayload = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  price: number;
  imageUrl: string | null;
  status: string;
  venueId: string;
  venue?: { name: string };
};

type ApiSuccessPayload = {
  event?: ApiEventPayload;
};

type ApiErrorPayload = {
  error?: string;
  fields?: Record<string, string>;
};

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toEditFormState(event: AdminEventItem): EditFormState {
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    venueId: event.venueId,
    startsAt: toDateTimeLocalValue(event.startsAt),
    endsAt: toDateTimeLocalValue(event.endsAt),
    capacity: String(event.capacity),
    price: String(event.price),
    imageUrl: event.imageUrl ?? "",
  };
}

function isEditableStatus(value: string): value is EditableStatus {
  return STATUS_OPTIONS.includes(value as EditableStatus);
}

function apiEventToAdminItem(
  event: ApiEventPayload,
  fallbackVenueName: string,
): AdminEventItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: new Date(event.startsAt).toISOString(),
    endsAt: new Date(event.endsAt).toISOString(),
    capacity: event.capacity,
    price: event.price,
    imageUrl: event.imageUrl,
    status: event.status,
    venueId: event.venueId,
    venueName: event.venue?.name ?? fallbackVenueName,
  };
}

function eventStatusClasses(status: string): string {
  if (status === "PUBLISHED") {
    return "bg-green-100 text-green-800";
  }

  if (status === "DRAFT") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-zinc-100 text-zinc-700";
}

export default function AdminEventsManager({
  initialEvents,
  venues,
}: AdminEventsManagerProps) {
  const [events, setEvents] = useState(initialEvents);
  const [statusDraftById, setStatusDraftById] = useState<
    Record<string, EditableStatus>
  >(() =>
    Object.fromEntries(
      initialEvents.map((event) => [
        event.id,
        isEditableStatus(event.status) ? event.status : "DRAFT",
      ]),
    ),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [eventPendingDelete, setEventPendingDelete] =
    useState<AdminEventItem | null>(null);

  function applyEventUpdate(updatedEvent: AdminEventItem) {
    setEvents((prev) =>
      prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)),
    );
    setStatusDraftById((prev) => ({
      ...prev,
      [updatedEvent.id]: isEditableStatus(updatedEvent.status)
        ? updatedEvent.status
        : "DRAFT",
    }));
  }

  function startEdit(event: AdminEventItem) {
    setEditingId(event.id);
    setEditForm(toEditFormState(event));
    setFieldErrors({});
    setBannerError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setFieldErrors({});
  }

  function updateEditField(field: keyof EditFormState, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function blockNegativeKeys(e: KeyboardEvent) {
    if (e.key === "-" || e.key === "e" || e.key === "E") {
      e.preventDefault();
    }
  }

  async function confirmDeleteEvent() {
    if (!eventPendingDelete) {
      return;
    }

    const event = eventPendingDelete;
    const actionKey = `delete:${event.id}`;
    setBusyAction(actionKey);
    setBannerError(null);

    try {
      const response = await fetch(API_ROUTES.eventById(event.id), {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as ApiErrorPayload;

      if (!response.ok) {
        setBannerError(data.error ?? "Failed to delete event.");
        return;
      }

      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      setStatusDraftById((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      if (editingId === event.id) {
        cancelEdit();
      }
    } catch {
      setBannerError("Network error while deleting event.");
    } finally {
      setEventPendingDelete(null);
      setBusyAction(null);
    }
  }

  async function handleStatusUpdate(event: AdminEventItem) {
    const nextStatus = statusDraftById[event.id];
    if (!nextStatus) {
      return;
    }

    const actionKey = `status:${event.id}`;
    setBusyAction(actionKey);
    setBannerError(null);

    try {
      const response = await fetch(API_ROUTES.eventById(event.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessPayload
        | ApiErrorPayload;

      if (!response.ok || !("event" in data) || !data.event) {
        const errorData = data as ApiErrorPayload;
        setBannerError(errorData.error ?? "Failed to update status.");
        return;
      }

      applyEventUpdate(apiEventToAdminItem(data.event, event.venueName));
    } catch {
      setBannerError("Network error while updating status.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId || !editForm) {
      return;
    }

    setFieldErrors({});
    setBannerError(null);
    const actionKey = `edit:${editingId}`;
    setBusyAction(actionKey);

    const payload = {
      title: editForm.title,
      description: editForm.description,
      category: editForm.category,
      venueId: editForm.venueId,
      startsAt: editForm.startsAt ? new Date(editForm.startsAt).toISOString() : "",
      endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : "",
      capacity: editForm.capacity ? parseInt(editForm.capacity, 10) : undefined,
      price: editForm.price ? parseFloat(editForm.price) : undefined,
      imageUrl: editForm.imageUrl || undefined,
    };

    try {
      const response = await fetch(API_ROUTES.eventById(editingId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessPayload
        | ApiErrorPayload;

      if (!response.ok || !("event" in data) || !data.event) {
        const errorData = data as ApiErrorPayload;
        if (errorData.fields) {
          setFieldErrors(errorData.fields);
        } else {
          setBannerError(errorData.error ?? "Failed to update event.");
        }
        return;
      }

      const existingEvent = events.find((event) => event.id === editingId);
      applyEventUpdate(
        apiEventToAdminItem(data.event, existingEvent?.venueName ?? ""),
      );
      cancelEdit();
    } catch {
      setBannerError("Network error while updating event.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {bannerError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bannerError}
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600">No events found.</p>
          <Link
            href="/admin/events/create"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create your first event
          </Link>
        </div>
      ) : null}

      {events.map((event) => {
        const isEditing = editingId === event.id;
        const isStatusBusy = busyAction === `status:${event.id}`;
        const isDeleteBusy = busyAction === `delete:${event.id}`;
        const isEditBusy = busyAction === `edit:${event.id}`;

        return (
          <article
            key={event.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {event.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatDateTime(new Date(event.startsAt))} | {event.venueName}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${eventStatusClasses(event.status)}`}
              >
                {capitalize(event.status.toLowerCase())}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <p>
                <span className="font-medium">Category:</span>{" "}
                {capitalize(event.category)}
              </p>
              <p>
                <span className="font-medium">Price:</span>{" "}
                {formatPrice(event.price)}
              </p>
              <p>
                <span className="font-medium">Capacity:</span> {event.capacity}
              </p>
              <p>
                <span className="font-medium">Ends:</span>{" "}
                {formatDateTime(new Date(event.endsAt))}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(event)}
                disabled={isEditBusy || isDeleteBusy || isStatusBusy}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setBannerError(null);
                  setEventPendingDelete(event);
                }}
                disabled={isDeleteBusy || isEditBusy || isStatusBusy}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleteBusy ? "Deleting..." : "Delete"}
              </button>
              <select
                value={statusDraftById[event.id] ?? "DRAFT"}
                onChange={(e) =>
                  setStatusDraftById((prev) => ({
                    ...prev,
                    [event.id]: e.target.value as EditableStatus,
                  }))
                }
                disabled={isStatusBusy || isDeleteBusy || isEditBusy}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {capitalize(status.toLowerCase())}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleStatusUpdate(event)}
                disabled={isStatusBusy || isDeleteBusy || isEditBusy}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStatusBusy ? "Updating..." : "Update status"}
              </button>
            </div>

            {isEditing && editForm ? (
              <form
                onSubmit={handleEditSubmit}
                className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Title"
                    name={`title-${event.id}`}
                    value={editForm.title}
                    onChange={(e) => updateEditField("title", e.target.value)}
                    error={fieldErrors.title}
                    required
                  />

                  <FormField
                    as="select"
                    label="Category"
                    name={`category-${event.id}`}
                    value={editForm.category}
                    onChange={(e) => updateEditField("category", e.target.value)}
                    error={fieldErrors.category}
                    required
                  >
                      <option value="">Select category</option>
                      {VALID_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {capitalize(category)}
                        </option>
                      ))}
                  </FormField>
                </div>

                <FormField
                  as="textarea"
                  label="Description"
                  name={`description-${event.id}`}
                  value={editForm.description}
                  onChange={(e) =>
                    updateEditField("description", e.target.value)
                  }
                  error={fieldErrors.description}
                  charCount={editForm.description.length}
                  maxLengthDisplay={5000}
                  required
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    as="select"
                    label="Venue"
                    name={`venueId-${event.id}`}
                    value={editForm.venueId}
                    onChange={(e) => updateEditField("venueId", e.target.value)}
                    error={fieldErrors.venueId}
                    required
                  >
                    <option value="">Select venue</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </FormField>

                  <FormField
                    label="Image URL"
                    name={`imageUrl-${event.id}`}
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => updateEditField("imageUrl", e.target.value)}
                    error={fieldErrors.imageUrl}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Starts At"
                    name={`startsAt-${event.id}`}
                    type="datetime-local"
                    value={editForm.startsAt}
                    onChange={(e) => updateEditField("startsAt", e.target.value)}
                    error={fieldErrors.startsAt}
                    required
                  />

                  <FormField
                    label="Ends At"
                    name={`endsAt-${event.id}`}
                    type="datetime-local"
                    value={editForm.endsAt}
                    onChange={(e) => updateEditField("endsAt", e.target.value)}
                    error={fieldErrors.endsAt}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Capacity"
                    name={`capacity-${event.id}`}
                    type="number"
                    min={1}
                    step={1}
                    value={editForm.capacity}
                    onChange={(e) => updateEditField("capacity", e.target.value)}
                    onKeyDown={blockNegativeKeys}
                    error={fieldErrors.capacity}
                    required
                  />

                  <FormField
                    label="Price"
                    name={`price-${event.id}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.price}
                    onChange={(e) => updateEditField("price", e.target.value)}
                    onKeyDown={blockNegativeKeys}
                    error={fieldErrors.price}
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isEditBusy}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isEditBusy ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isEditBusy}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}

      {eventPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              Delete event
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Delete &quot;{eventPendingDelete.title}&quot;? This action cannot
              be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEventPendingDelete(null)}
                disabled={busyAction === `delete:${eventPendingDelete.id}`}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEvent}
                disabled={busyAction === `delete:${eventPendingDelete.id}`}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `delete:${eventPendingDelete.id}`
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
