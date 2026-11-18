"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import {
  getAttendanceDayForUser,
  markAttendanceForUser,
} from "@/lib/attendance/queries";
import type { AttendanceMark } from "@/lib/attendance/types";
import { requireSession } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";

/** Load the marking screen for another day. */
export async function getAttendanceDayAction(orgCode: string, date: string) {
  return runAction(async () => {
    const session = await requireSession();
    const day = await getAttendanceDayForUser(session.userId, orgCode, date);
    if (!day) throw new UserError("Select a valid date.");
    return day;
  });
}

export async function markAttendanceAction(
  orgCode: string,
  date: string,
  marks: AttendanceMark[],
) {
  return runAction(async () => {
    const session = await requireSession();
    const day = await markAttendanceForUser(
      session.userId,
      orgCode,
      date,
      marks,
    );
    revalidateCompanyPages();
    return day;
  });
}
