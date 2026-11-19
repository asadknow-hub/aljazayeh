"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@/components/ui/icons";

/** Parts of a path that only group pages and have no page of their own. */
const GROUPING_SEGMENTS = new Set(["inquiries", "forms", "leave"]);

/**
 * The page one level up from where the person is: an inquiry goes back to
 * its department, a department back to the company's home screen.
 */
function parentOf(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  segments.pop();
  while (
    segments.length > 1 &&
    GROUPING_SEGMENTS.has(segments[segments.length - 1]!)
  ) {
    segments.pop();
  }
  return `/${segments.join("/")}`;
}

/** Back button at the left of the header, on every page that has a parent. */
export function HeaderBack() {
  const parent = parentOf(usePathname());
  if (!parent) return null;

  return (
    <Link
      href={parent}
      aria-label="Back"
      title="Back"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-header-control text-header-fg transition-colors hover:bg-header-control-hover"
    >
      <ArrowLeftIcon className="h-4 w-4" />
    </Link>
  );
}
