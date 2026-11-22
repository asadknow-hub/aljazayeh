"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeclaredBackTarget } from "@/components/providers/page-title-provider";
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

/**
 * Back button at the left of the header, on every page that has a parent. A
 * page may say where its own list is; otherwise it is one level up.
 */
export function HeaderBack() {
  const declared = useDeclaredBackTarget();
  const pathname = usePathname();
  const parent = declared ?? parentOf(pathname);
  if (!parent) return null;

  return (
    <Link
      href={parent}
      // Not fetched ahead: a page that names its own list does so just after
      // it appears, and the address worked out before then may not exist.
      prefetch={false}
      aria-label="Back"
      title="Back"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-header-control text-header-fg transition-colors hover:bg-header-control-hover"
    >
      <ArrowLeftIcon className="h-4 w-4" />
    </Link>
  );
}
