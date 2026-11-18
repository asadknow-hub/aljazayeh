/**
 * Signing in: a login locks for a while after too many wrong passwords, so
 * passwords cannot be guessed, without shutting a forgetful person out.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import postgres from "postgres";
import { PASSWORD, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { MAX_FAILED_LOGINS, authenticateUser } from "@/lib/auth/authenticate";
import { createOrganizationForUser } from "@/lib/org/queries";
import { recordSuccessfulLogin } from "@/lib/profile/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
  resetStaffPasswordForUser,
} from "@/lib/staff/queries";

const run = Date.now().toString(36);
const ORG = `login-${run}`;
const USERNAME = `lina.${run}`;
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
let staffId: string;

const wrongPasswords = async (count: number) => {
  for (let attempt = 0; attempt < count; attempt += 1) {
    assert.equal(await authenticateUser(USERNAME, "not-the-password"), null);
  }
};

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;
  await createOrganizationForUser(owner, { name: "Login Works", code: ORG });
  const staff = await createStaffForUser(owner, ORG, {
    fullName: "Lina",
    email: "",
    phone: "",
    homeCountryContact: "",
    passportNumber: "",
    jobTitle: "",
    employeeCode: "",
    joinedOn: "",
    status: "active",
    notes: "",
    departmentKeys: ["sales"],
  });
  staffId = staff.id;
  await createStaffLoginForUser(owner, ORG, staffId, {
    username: USERNAME,
    password: PASSWORD,
  });
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

test("a few wrong passwords do not lock the login, and signing in clears the count", async () => {
  await wrongPasswords(MAX_FAILED_LOGINS - 1);
  const user = await authenticateUser(USERNAME, PASSWORD);
  assert.ok(user);
  await recordSuccessfulLogin(user.userId, { ipAddress: "", userAgent: "" });

  // The count started again, so this many more still do not lock it.
  await wrongPasswords(MAX_FAILED_LOGINS - 1);
  assert.ok(await authenticateUser(USERNAME, PASSWORD));
});

test("the 20th wrong password in a row locks it, even for the right password", async () => {
  await wrongPasswords(1);
  await refused(
    authenticateUser(USERNAME, PASSWORD),
    /Try again in 15 minutes/,
  );
  await refused(authenticateUser(USERNAME, "x"), /Too many wrong passwords/);
});

test("the lock ends by itself", async () => {
  await admin`
    update users set login_locked_until = now() - interval '1 second'
    where username = ${USERNAME}
  `;
  assert.ok(await authenticateUser(USERNAME, PASSWORD));
});

test("an administrator's password reset unlocks it straight away", async () => {
  await wrongPasswords(MAX_FAILED_LOGINS);
  await refused(
    authenticateUser(USERNAME, PASSWORD),
    /Too many wrong passwords/,
  );

  await resetStaffPasswordForUser(owner, ORG, staffId, "a-brand-new-password");
  assert.ok(await authenticateUser(USERNAME, "a-brand-new-password"));
});

test("an unknown username is just wrong, never locked", async () => {
  for (let attempt = 0; attempt < MAX_FAILED_LOGINS + 2; attempt += 1) {
    assert.equal(await authenticateUser(`nobody.${run}`, "x"), null);
  }
});
