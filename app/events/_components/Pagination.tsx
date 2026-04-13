import Link from "next/link";

/** Maximum pages shown before switching to ellipsis layout */
const FULL_WINDOW = 7;
/** Pages shown on each side of the current page in ellipsis layout */
const SIDE_PAGES = 1;
/** Distance from an edge before an ellipsis appears */
const EDGE_THRESHOLD = 2;

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= FULL_WINDOW) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > EDGE_THRESHOLD + 1) pages.push("...");

  const start = Math.max(2, current - SIDE_PAGES);
  const end = Math.min(total - 1, current + SIDE_PAGES);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - EDGE_THRESHOLD) pages.push("...");

  pages.push(total);

  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const page = Math.min(Math.max(currentPage, 1), totalPages);

  const pages = getPageRange(page, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const baseLinkClass =
    "flex h-9 min-w-[2.25rem] items-center justify-center rounded border px-2 text-sm";
  const activeClass = "border-blue-600 bg-blue-600 font-medium text-white";
  const inactiveClass =
    "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  const disabledClass =
    "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed";

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={buildHref(page - 1)}
          className={`${baseLinkClass} ${inactiveClass}`}
          aria-label="Previous page"
        >
          ‹
        </Link>
      ) : (
        <span
          className={`${baseLinkClass} ${disabledClass}`}
          aria-label="Previous page (unavailable)"
          aria-disabled="true"
          tabIndex={-1}
        >
          ‹
        </span>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="flex h-9 min-w-[2.25rem] items-center justify-center text-sm text-zinc-400"
            aria-hidden="true"
          >
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            className={`${baseLinkClass} ${activeClass}`}
            aria-current="page"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`${baseLinkClass} ${inactiveClass}`}
            aria-label={`Page ${p}`}
          >
            {p}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={buildHref(page + 1)}
          className={`${baseLinkClass} ${inactiveClass}`}
          aria-label="Next page"
        >
          ›
        </Link>
      ) : (
        <span
          className={`${baseLinkClass} ${disabledClass}`}
          aria-label="Next page (unavailable)"
          aria-disabled="true"
          tabIndex={-1}
        >
          ›
        </span>
      )}
    </nav>
  );
}
