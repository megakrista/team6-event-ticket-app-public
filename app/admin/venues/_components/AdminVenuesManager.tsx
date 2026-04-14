"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API_ROUTES } from "@/lib/api-routes";
import FormField from "@/ui/components/FormField";

export type AdminVenueItem = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
  eventCount: number;
};

type AdminVenuesManagerProps = {
  initialVenues: AdminVenueItem[];
};

type VenueFormState = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  timezone: string;
};

type ApiVenuePayload = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type ApiSuccessPayload = { venue?: ApiVenuePayload };
type ApiErrorPayload = { error?: string; fields?: Record<string, string> };

const EMPTY_FORM: VenueFormState = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  timezone: "",
};

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Tallinn",
  "Europe/Helsinki",
  "Europe/Riga",
  "Europe/Vilnius",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
] as const;

function toFormState(venue: AdminVenueItem): VenueFormState {
  return {
    name: venue.name,
    address: venue.address,
    latitude: String(venue.latitude),
    longitude: String(venue.longitude),
    timezone: venue.timezone,
  };
}

function apiVenueToAdminItem(
  api: ApiVenuePayload,
  eventCount: number,
): AdminVenueItem {
  return {
    id: api.id,
    name: api.name,
    address: api.address,
    latitude: api.latitude,
    longitude: api.longitude,
    timezone: api.timezone,
    eventCount,
  };
}

export default function AdminVenuesManager({
  initialVenues,
}: AdminVenuesManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [venues, setVenues] = useState(initialVenues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VenueFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [venuePendingDelete, setVenuePendingDelete] =
    useState<AdminVenueItem | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<VenueFormState>(EMPTY_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState<
    Record<string, string>
  >({});
  const [isCreateBusy, setIsCreateBusy] = useState(false);

  function startEdit(venue: AdminVenueItem) {
    setEditingId(venue.id);
    setEditForm(toFormState(venue));
    setFieldErrors({});
    setBannerError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setFieldErrors({});
  }

  function updateEditField(field: keyof VenueFormState, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  const startCreate = useCallback(() => {
    setIsCreating(true);
    setCreateForm(EMPTY_FORM);
    setCreateFieldErrors({});
    setBannerError(null);
  }, []);

  function cancelCreate() {
    setIsCreating(false);
    setCreateForm(EMPTY_FORM);
    setCreateFieldErrors({});
    if (searchParams.get("create") === "1") {
      router.replace(pathname, { scroll: false });
    }
  }

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    startCreate();
    router.replace(pathname, { scroll: false });
  }, [pathname, router, searchParams, startCreate]);

  function updateCreateField(field: keyof VenueFormState, value: string) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    if (createFieldErrors[field]) {
      setCreateFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateFieldErrors({});
    setBannerError(null);
    setIsCreateBusy(true);

    const payload = {
      name: createForm.name,
      address: createForm.address,
      latitude: createForm.latitude ? parseFloat(createForm.latitude) : undefined,
      longitude: createForm.longitude
        ? parseFloat(createForm.longitude)
        : undefined,
      timezone: createForm.timezone,
    };

    try {
      const response = await fetch(API_ROUTES.venues, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessPayload
        | ApiErrorPayload;

      if (!response.ok || !("venue" in data) || !data.venue) {
        const errorData = data as ApiErrorPayload;
        if (errorData.fields) {
          setCreateFieldErrors(errorData.fields);
        } else {
          setBannerError(errorData.error ?? "Failed to create venue.");
        }
        return;
      }

      setVenues((prev) => [...prev, apiVenueToAdminItem(data.venue!, 0)]);
      cancelCreate();
    } catch {
      setBannerError("Network error while creating venue.");
    } finally {
      setIsCreateBusy(false);
    }
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId || !editForm) return;

    setFieldErrors({});
    setBannerError(null);
    const actionKey = `edit:${editingId}`;
    setBusyAction(actionKey);

    const payload = {
      name: editForm.name,
      address: editForm.address,
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : undefined,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : undefined,
      timezone: editForm.timezone,
    };

    try {
      const response = await fetch(API_ROUTES.venueById(editingId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | ApiSuccessPayload
        | ApiErrorPayload;

      if (!response.ok || !("venue" in data) || !data.venue) {
        const errorData = data as ApiErrorPayload;
        if (errorData.fields) {
          setFieldErrors(errorData.fields);
        } else {
          setBannerError(errorData.error ?? "Failed to update venue.");
        }
        return;
      }

      const existing = venues.find((v) => v.id === editingId);
      setVenues((prev) =>
        prev.map((v) =>
          v.id === editingId
            ? apiVenueToAdminItem(data.venue!, existing?.eventCount ?? 0)
            : v,
        ),
      );
      cancelEdit();
    } catch {
      setBannerError("Network error while updating venue.");
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmDeleteVenue() {
    if (!venuePendingDelete) return;

    const venue = venuePendingDelete;
    const actionKey = `delete:${venue.id}`;
    setBusyAction(actionKey);
    setBannerError(null);

    try {
      const response = await fetch(API_ROUTES.venueById(venue.id), {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as ApiErrorPayload;

      if (!response.ok) {
        setBannerError(data.error ?? "Failed to delete venue.");
        return;
      }

      setVenues((prev) => prev.filter((v) => v.id !== venue.id));
      if (editingId === venue.id) cancelEdit();
    } catch {
      setBannerError("Network error while deleting venue.");
    } finally {
      setVenuePendingDelete(null);
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

      {isCreating ? (
        <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            New venue
          </h2>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <VenueFormFields
              form={createForm}
              errors={createFieldErrors}
              idSuffix="new"
              onFieldChange={updateCreateField}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isCreateBusy}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreateBusy ? "Creating..." : "Create venue"}
              </button>
              <button
                type="button"
                onClick={cancelCreate}
                disabled={isCreateBusy}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {venues.length === 0 && !isCreating ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600">No venues yet.</p>
          <Link
            href="/admin/venues?create=1"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add your first venue
          </Link>
        </div>
      ) : null}

      {venues.map((venue) => {
        const isEditing = editingId === venue.id;
        const isEditBusy = busyAction === `edit:${venue.id}`;
        const isDeleteBusy = busyAction === `delete:${venue.id}`;
        const canDelete = venue.eventCount === 0;

        return (
          <article
            key={venue.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {venue.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{venue.address}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {venue.eventCount} event{venue.eventCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-3 grid gap-1 text-sm text-zinc-700 sm:grid-cols-3">
              <p>
                <span className="font-medium">Timezone:</span> {venue.timezone}
              </p>
              <p>
                <span className="font-medium">Lat:</span> {venue.latitude}
              </p>
              <p>
                <span className="font-medium">Lng:</span> {venue.longitude}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startEdit(venue)}
                disabled={isEditBusy || isDeleteBusy}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setBannerError(null);
                    setVenuePendingDelete(venue);
                  }}
                  disabled={isDeleteBusy || isEditBusy}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleteBusy ? "Deleting..." : "Delete"}
                </button>
              ) : (
                <span
                  title={`Reassign all ${venue.eventCount} event${venue.eventCount !== 1 ? "s" : ""} before deleting`}
                  className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-400"
                >
                  Delete
                </span>
              )}
            </div>

            {isEditing && editForm ? (
              <form
                onSubmit={handleEditSubmit}
                className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <VenueFormFields
                  form={editForm}
                  errors={fieldErrors}
                  idSuffix={venue.id}
                  onFieldChange={updateEditField}
                />
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

      {venuePendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              Delete venue
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Delete &quot;{venuePendingDelete.name}&quot;? This action cannot
              be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVenuePendingDelete(null)}
                disabled={busyAction === `delete:${venuePendingDelete.id}`}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteVenue}
                disabled={busyAction === `delete:${venuePendingDelete.id}`}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `delete:${venuePendingDelete.id}`
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

type VenueFormFieldsProps = {
  form: VenueFormState;
  errors: Record<string, string>;
  idSuffix: string;
  onFieldChange: (field: keyof VenueFormState, value: string) => void;
};

function VenueFormFields({
  form,
  errors,
  idSuffix,
  onFieldChange,
}: VenueFormFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Name"
          name={`name-${idSuffix}`}
          value={form.name}
          onChange={(e) => onFieldChange("name", e.target.value)}
          error={errors.name}
          required
        />
        <FormField
          label="Timezone"
          name={`timezone-${idSuffix}`}
          list={`timezone-options-${idSuffix}`}
          value={form.timezone}
          onChange={(e) => onFieldChange("timezone", e.target.value)}
          error={errors.timezone}
          placeholder="e.g. Europe/Tallinn"
          required
        />
        <datalist id={`timezone-options-${idSuffix}`}>
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </div>
      <FormField
        label="Address"
        name={`address-${idSuffix}`}
        value={form.address}
        onChange={(e) => onFieldChange("address", e.target.value)}
        error={errors.address}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Latitude"
          name={`latitude-${idSuffix}`}
          type="number"
          step="any"
          value={form.latitude}
          onChange={(e) => onFieldChange("latitude", e.target.value)}
          error={errors.latitude}
          placeholder="-90 to 90"
          required
        />
        <FormField
          label="Longitude"
          name={`longitude-${idSuffix}`}
          type="number"
          step="any"
          value={form.longitude}
          onChange={(e) => onFieldChange("longitude", e.target.value)}
          error={errors.longitude}
          placeholder="-180 to 180"
          required
        />
      </div>
    </>
  );
}
