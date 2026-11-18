import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Refresh every page under /{orgCode}. Most changes show up in several
 * places at once (lists, queues, the company home), so pages are not
 * refreshed one by one.
 */
export function revalidateCompanyPages() {
  revalidatePath("/[orgCode]", "layout");
}
