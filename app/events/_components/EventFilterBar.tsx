"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FormField from "@/ui/components/FormField";
import { capitalize } from "@/lib/format-helpers";
import { VALID_CATEGORIES } from "@/types/eventtype";

type Filters = { search: string; category: string; dateFrom: string };

export default function EventFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get("search") ?? "",
    category: searchParams.get("category") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const applyFilters = useCallback((f: Filters) => {
    const params = new URLSearchParams();
    if (f.search) params.set("search", f.search);
    if (f.category) params.set("category", f.category);
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    const qs = params.toString();
    router.replace(qs ? `/events?${qs}` : "/events");
  }, [router]);

  useEffect(() => {
    const id = setTimeout(() => applyFilters(filtersRef.current), 400);
    return () => clearTimeout(id);
  }, [filters.search, applyFilters]);

  function handleCategoryChange(category: string) {
    const updated = { ...filtersRef.current, category };
    filtersRef.current = updated;
    setFilters(updated);
    applyFilters(updated);
  }

  function handleDateChange(dateFrom: string) {
    const updated = { ...filtersRef.current, dateFrom };
    filtersRef.current = updated;
    setFilters(updated);
    applyFilters(updated);
  }

  const hasActiveFilters = !!(
    filters.search ||
    filters.category ||
    filters.dateFrom
  );

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="min-w-[180px] flex-1">
        <FormField
          label="Search"
          name="search"
          type="text"
          placeholder="Search events..."
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
        />
      </div>

      <div className="w-44">
        <FormField
          as="select"
          label="Category"
          name="category"
          value={filters.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">All categories</option>
          {VALID_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {capitalize(cat)}
            </option>
          ))}
        </FormField>
      </div>

      <div className="w-44">
        <FormField
          label="From date"
          name="dateFrom"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleDateChange(e.target.value)}
        />
      </div>

      {hasActiveFilters && (
        <div className="flex items-end pb-0.5">
          <button
            onClick={() => {
              const cleared = { search: "", category: "", dateFrom: "" };
              filtersRef.current = cleared;
              setFilters(cleared);
              router.replace("/events");
            }}
            className="rounded border border-zinc-300 px-3 py-3 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
