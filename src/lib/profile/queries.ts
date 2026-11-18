import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db, withTenantContext } from "@/db/client";
import {
  userContracts,
  userLoginEvents,
  userSalary,
  users,
} from "@/db/schema";
import type {
  ContractView,
  LoginActivityItem,
  ProfileIdentity,
  ProfileSettingsBundle,
  SalaryView,
} from "@/lib/profile/types";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { UserError } from "@/lib/errors";
import { assertValidPassword } from "@/lib/staff/validate";

const emptySalary: SalaryView = {
  amount: "0",
  currency: "AED",
  payFrequency: "monthly",
  effectiveFrom: "",
  notes: "",
};

const emptyContract: ContractView = {
  id: null,
  title: "",
  status: "active",
  startDate: "",
  endDate: "",
  notes: "",
};

export async function getUserDisplayName(
  userId: string,
): Promise<{ fullName: string; username: string } | null> {
  return withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({
        fullName: users.fullName,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  });
}

export async function getProfileSettingsBundle(
  userId: string,
): Promise<ProfileSettingsBundle | null> {
  return withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    const identity: ProfileIdentity = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
    };

    const loginRows = await tx
      .select({
        id: userLoginEvents.id,
        occurredAt: userLoginEvents.occurredAt,
        ipAddress: userLoginEvents.ipAddress,
        userAgent: userLoginEvents.userAgent,
        success: userLoginEvents.success,
      })
      .from(userLoginEvents)
      .where(eq(userLoginEvents.userId, userId))
      .orderBy(desc(userLoginEvents.occurredAt))
      .limit(50);

    const loginActivity: LoginActivityItem[] = loginRows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      success: row.success,
    }));

    const [salaryRow] = await tx
      .select()
      .from(userSalary)
      .where(eq(userSalary.userId, userId))
      .limit(1);

    const salary: SalaryView = salaryRow
      ? {
          amount: String(salaryRow.amount),
          currency: salaryRow.currency,
          payFrequency: salaryRow.payFrequency,
          effectiveFrom: salaryRow.effectiveFrom,
          notes: salaryRow.notes,
        }
      : emptySalary;

    const [contractRow] = await tx
      .select()
      .from(userContracts)
      .where(eq(userContracts.userId, userId))
      .orderBy(desc(userContracts.updatedAt))
      .limit(1);

    const contract: ContractView = contractRow
      ? {
          id: contractRow.id,
          title: contractRow.title,
          status: contractRow.status,
          startDate: contractRow.startDate,
          endDate: contractRow.endDate,
          notes: contractRow.notes,
        }
      : emptyContract;

    return { identity, loginActivity, salary, contract };
  });
}

export async function recordSuccessfulLogin(
  userId: string,
  meta: { ipAddress: string; userAgent: string },
): Promise<void> {
  // Security-definer RPC — works at login time without depending on RLS GUC.
  await db.execute(sql`
    select app_record_login(
      ${userId}::uuid,
      ${meta.ipAddress},
      ${meta.userAgent}
    )
  `);
}

export async function updateUserFullName(userId: string, fullName: string) {
  const value = fullName.trim();
  if (!value) {
    throw new UserError("Name is required.");
  }
  if (value.length > 120) {
    throw new UserError("Name must be 120 characters or fewer.");
  }

  return withTenantContext(userId, async (tx) => {
    await tx
      .update(users)
      .set({ fullName: value, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return value;
  });
}

export async function updateUserEmail(userId: string, email: string) {
  const value = email.trim().toLowerCase();
  if (!value) {
    throw new UserError("Email is required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new UserError("Email must be a valid email address.");
  }

  return withTenantContext(userId, async (tx) => {
    await tx
      .update(users)
      .set({ email: value, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return value;
  });
}

export async function updateUserPassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
) {
  if (!input.currentPassword) {
    throw new UserError("Current password is required.");
  }
  assertValidPassword(input.newPassword);
  if (input.newPassword !== input.confirmPassword) {
    throw new UserError("New password and confirmation do not match.");
  }

  return withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UserError("User not found.");
    }

    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UserError("Current password is incorrect.");
    }

    const passwordHash = await hashPassword(input.newPassword);
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}

export async function upsertUserSalary(userId: string, input: SalaryView) {
  const amount = input.amount.trim();
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) < 0) {
    throw new UserError("Salary amount must be a valid non-negative number.");
  }
  const currency = input.currency.trim().toUpperCase() || "AED";
  const payFrequency = input.payFrequency.trim() || "monthly";

  return withTenantContext(userId, async (tx) => {
    const [existing] = await tx
      .select({ userId: userSalary.userId })
      .from(userSalary)
      .where(eq(userSalary.userId, userId))
      .limit(1);

    const values = {
      amount,
      currency,
      payFrequency,
      effectiveFrom: input.effectiveFrom.trim(),
      notes: input.notes.trim(),
      updatedAt: new Date(),
    };

    if (existing) {
      await tx
        .update(userSalary)
        .set(values)
        .where(eq(userSalary.userId, userId));
    } else {
      await tx.insert(userSalary).values({ userId, ...values });
    }

    return {
      amount,
      currency,
      payFrequency,
      effectiveFrom: values.effectiveFrom,
      notes: values.notes,
    } satisfies SalaryView;
  });
}

export async function upsertUserContract(userId: string, input: ContractView) {
  const title = input.title.trim();
  if (!title) {
    throw new UserError("Contract title is required.");
  }

  const values = {
    title,
    status: input.status.trim() || "active",
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    notes: input.notes.trim(),
    updatedAt: new Date(),
  };

  return withTenantContext(userId, async (tx) => {
    if (input.id) {
      const [existing] = await tx
        .select({ id: userContracts.id })
        .from(userContracts)
        .where(eq(userContracts.id, input.id))
        .limit(1);

      if (!existing) {
        throw new UserError("Contract not found.");
      }

      await tx
        .update(userContracts)
        .set(values)
        .where(eq(userContracts.id, input.id));

      return { id: input.id, ...values } satisfies ContractView;
    }

    const [created] = await tx
      .insert(userContracts)
      .values({ userId, ...values })
      .returning({ id: userContracts.id });

    return { id: created.id, ...values } satisfies ContractView;
  });
}
