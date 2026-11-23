"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  addPositionForUser,
  moveOwnerForUser,
  removePositionForUser,
  setDepartmentInUseForUser,
  updatePositionForUser,
} from "@/lib/organization/queries";
import type { PositionInput } from "@/lib/organization/types";

/** Run a change to the chart; every page that shows who signs is refreshed. */
function change<T>(work: (userId: string) => Promise<T>) {
  return runAction(async () => {
    const session = await requireSession();
    const result = await work(session.userId);
    revalidateCompanyPages();
    return result;
  });
}

export async function addPositionAction(orgCode: string, input: PositionInput) {
  return change((userId) => addPositionForUser(userId, orgCode, input));
}

export async function updatePositionAction(
  orgCode: string,
  positionId: string,
  input: { title: string; staffId: string },
) {
  return change((userId) =>
    updatePositionForUser(userId, orgCode, positionId, input),
  );
}

export async function removePositionAction(
  orgCode: string,
  positionId: string,
) {
  return change((userId) => removePositionForUser(userId, orgCode, positionId));
}

export async function moveOwnerAction(
  orgCode: string,
  positionId: string,
  direction: "earlier" | "later",
) {
  return change((userId) =>
    moveOwnerForUser(userId, orgCode, positionId, direction),
  );
}

export async function setDepartmentInUseAction(
  orgCode: string,
  departmentKey: string,
  inUse: boolean,
) {
  return change((userId) =>
    setDepartmentInUseForUser(userId, orgCode, departmentKey, inUse),
  );
}
