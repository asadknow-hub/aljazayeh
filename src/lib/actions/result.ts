import { UserError } from "@/lib/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wrap the body of a server action. Next.js hides the message of anything
 * thrown on the server in production, so expected problems (UserError) are
 * returned as a value instead. Unexpected errors still throw.
 */
export async function runAction<T>(
  work: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof UserError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** Client side: get the data of an action, or throw its message to show the user. */
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const settled = await result;
  if (!settled.ok) {
    throw new Error(settled.error);
  }
  return settled.data;
}
