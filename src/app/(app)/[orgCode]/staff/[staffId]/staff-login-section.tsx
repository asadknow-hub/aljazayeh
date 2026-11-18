"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { unwrap } from "@/lib/actions/result";
import {
  createStaffLoginAction,
  resetStaffPasswordAction,
  setStaffAdminAction,
} from "@/lib/staff/actions";
import type { StaffView } from "@/lib/staff/types";
import { MIN_PASSWORD_LENGTH } from "@/lib/staff/validate";

type StaffLoginSectionProps = {
  orgCode: string;
  staff: StaffView;
  /** The signed-in person looking at this page. */
  viewer: { staffId: string; canManageCompany: boolean };
  onChange: (staff: StaffView) => void;
};

const inputClass =
  "w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header";
const buttonClass =
  "bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45";

/** Lets a company administrator give a staff member access to the system. */
export function StaffLoginSection({
  orgCode,
  staff,
  viewer,
  onChange,
}: StaffLoginSectionProps) {
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSelf = viewer.staffId === staff.id;
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;

  async function run(work: () => Promise<void>) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  const createLogin = () =>
    run(async () => {
      onChange(
        await unwrap(
          createStaffLoginAction(orgCode, staff.id, { username, password }),
        ),
      );
      setUsername("");
      setPassword("");
      showToast("Login created");
    });

  const resetPassword = () =>
    run(async () => {
      await unwrap(resetStaffPasswordAction(orgCode, staff.id, password));
      setPassword("");
      showToast("Password reset");
    });

  const setAdmin = (isAdmin: boolean) =>
    run(async () => {
      onChange(await unwrap(setStaffAdminAction(orgCode, staff.id, isAdmin)));
      showToast(isAdmin ? "Made administrator" : "Administrator access removed");
    });

  if (!viewer.canManageCompany) {
    return (
      <p className="text-sm text-zinc-600">
        {staff.loginUsername
          ? `Signs in as ${staff.loginUsername}. `
          : "No login yet. "}
        Only a company administrator can manage logins.
      </p>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-5">
      {staff.status !== "active" ? (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This person is Inactive, so they cannot sign in. Set their status to
          Active on the Profile tab to give access back.
        </p>
      ) : null}

      {staff.loginUsername ? (
        <>
          <div>
            <p className="text-sm text-zinc-600">Signs in as</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-900">
              {staff.loginUsername}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Set a new password
            </span>
            <input
              type="text"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              className={inputClass}
            />
            <span className="text-xs text-zinc-500">
              Tell them the new password; they can change it under their own
              Account page.
            </span>
          </label>
          <div>
            <button
              type="button"
              onClick={resetPassword}
              disabled={pending || !passwordOk}
              className={buttonClass}
            >
              Reset password
            </button>
          </div>

          <label className="flex items-start gap-2 border-t border-zinc-200 pt-4">
            <input
              type="checkbox"
              checked={staff.isAdmin}
              disabled={pending || isSelf}
              onChange={(event) => setAdmin(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Company administrator
              </span>
              <span className="block text-sm text-zinc-600">
                Can change company settings, manage logins and do everything
                in this company.
                {isSelf ? " You cannot remove this from yourself." : ""}
              </span>
            </span>
          </label>
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            This person cannot sign in yet. Give them a username and a first
            password. What they can see depends on their departments on the
            Profile tab.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Username</span>
            <input
              type="text"
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. ahmed.k"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              First password
            </span>
            <input
              type="text"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              className={inputClass}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={createLogin}
              disabled={pending || !username.trim() || !passwordOk}
              className={buttonClass}
            >
              Create login
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
