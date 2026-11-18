"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { logout } from "@/app/login/actions";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  changeProfilePasswordAction,
  saveProfileContractAction,
  saveProfileEmailAction,
  saveProfileNameAction,
  saveProfileSalaryAction,
} from "@/lib/profile/actions";
import { formatFriendlyDateTime } from "@/lib/datetime/format";
import {
  PROFILE_SECTION_META,
  type ContractView,
  type ProfileSection,
  type ProfileSettingsBundle,
  type SalaryView,
} from "@/lib/profile/types";
import { unwrap } from "@/lib/actions/result";

type ProfileSettingsClientProps = {
  initialSection: ProfileSection;
  initialBundle: ProfileSettingsBundle;
};

function LoginActivityWhen({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <time dateTime={iso}>
      {Number.isNaN(date.getTime()) ? iso : formatFriendlyDateTime(date)}
    </time>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4 10.5 7-.5 1-1.3 2.1-2.4 3.1M6.1 6.1C4.6 7.3 3.5 8.8 2.5 12c1.5 3 5.5 7 10.5 7 1.2 0 2.3-.2 3.4-.6"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12C4 9 8 5 12 5s8 4 9.5 7c-1.5 3-5.5 7-9.5 7s-8-4-9.5-7z"
      />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-zinc-700">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="w-full border border-zinc-300 py-2 pr-10 pl-3 text-sm outline-none focus:border-header"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-zinc-500 transition hover:text-zinc-800"
        >
          <EyeIcon open={visible} />
        </button>
      </span>
    </label>
  );
}

export function ProfileSettingsClient({
  initialSection,
  initialBundle,
}: ProfileSettingsClientProps) {
  usePageTitle("Settings");
  const router = useRouter();
  const { showToast } = useToast();

  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [identity, setIdentity] = useState(initialBundle.identity);
  const [loginActivity] = useState(initialBundle.loginActivity);
  const [salary, setSalary] = useState(initialBundle.salary);
  const [contract, setContract] = useState(initialBundle.contract);

  const [fullName, setFullName] = useState(initialBundle.identity.fullName);
  const [email, setEmail] = useState(initialBundle.identity.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [salaryForm, setSalaryForm] = useState<SalaryView>(initialBundle.salary);
  const [contractForm, setContractForm] = useState<ContractView>(
    initialBundle.contract,
  );

  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  const isDirty = useMemo(() => {
    if (section === "account") {
      return fullName !== identity.fullName || email !== identity.email;
    }
    if (section === "salary") {
      return (
        salaryForm.amount !== salary.amount ||
        salaryForm.currency !== salary.currency ||
        salaryForm.payFrequency !== salary.payFrequency ||
        salaryForm.effectiveFrom !== salary.effectiveFrom ||
        salaryForm.notes !== salary.notes
      );
    }
    if (section === "contract") {
      return (
        contractForm.title !== contract.title ||
        contractForm.status !== contract.status ||
        contractForm.startDate !== contract.startDate ||
        contractForm.endDate !== contract.endDate ||
        contractForm.notes !== contract.notes
      );
    }
    return false;
  }, [
    section,
    fullName,
    identity.fullName,
    email,
    identity.email,
    salaryForm,
    salary,
    contractForm,
    contract,
  ]);

  const passwordDirty = Boolean(
    currentPassword || newPassword || confirmPassword,
  );
  const canSavePassword = passwordDirty && !passwordPending;
  const canSave =
    isDirty &&
    !pending &&
    section !== "login-activity" &&
    section !== "actions";

  function selectSection(next: ProfileSection) {
    setSection(next);
    setError(null);
    setPasswordError(null);
    router.replace(`/settings?section=${next}`, { scroll: false });
  }

  function onCancel() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  async function onSavePassword() {
    if (!canSavePassword) return;
    setPasswordError(null);
    setPasswordPending(true);
    try {
      await unwrap(changeProfilePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated");
      router.refresh();
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Could not update password.",
      );
    } finally {
      setPasswordPending(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setError(null);
    setPending(true);
    try {
      if (section === "account") {
        const nameChanged = fullName !== identity.fullName;
        const emailChanged = email !== identity.email;

        if (nameChanged) {
          const saved = await unwrap(saveProfileNameAction(fullName));
          setIdentity((current) => ({ ...current, fullName: saved.fullName }));
          setFullName(saved.fullName);
        }
        if (emailChanged) {
          const saved = await unwrap(saveProfileEmailAction(email));
          setIdentity((current) => ({ ...current, email: saved.email }));
          setEmail(saved.email);
        }
        showToast("Account settings saved");
      } else if (section === "salary") {
        const saved = await unwrap(saveProfileSalaryAction(salaryForm));
        setSalary(saved);
        setSalaryForm(saved);
        showToast("Salary saved");
      } else if (section === "contract") {
        const saved = await unwrap(saveProfileContractAction(contractForm));
        setContract(saved);
        setContractForm(saved);
        showToast("Contract saved");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none fixed top-14 right-4 z-30 sm:right-6">
        <div className="pointer-events-auto flex items-center gap-2 border border-zinc-200 bg-white px-2 py-1.5 shadow-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-settings-form"
            disabled={!canSave}
            className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white sm:w-56">
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {PROFILE_SECTION_META.map((item) => {
              const active = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={[
                    "px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-header text-header-fg"
                      : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <form
            id="profile-settings-form"
            onSubmit={onSave}
            className="w-full max-w-3xl border border-zinc-300 bg-white"
          >
            {section === "account" ? (
              <SectionShell
                title="Account"
                description="Name, email, and password for your personal login."
              >
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                  <div className="flex max-w-sm flex-col gap-3">
                    <p className="text-sm font-medium text-zinc-900">
                      Account
                    </p>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-zinc-700">
                        Full name
                      </span>
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-zinc-700">
                        Login username
                      </span>
                      <input
                        value={identity.username}
                        readOnly
                        className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-600 outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-zinc-700">
                        Email
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                      />
                    </label>
                  </div>

                  <div className="flex max-w-sm flex-col gap-3 sm:border-l sm:border-zinc-200 sm:pl-8">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        Password
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Leave blank to keep your current password.
                      </p>
                    </div>
                    <PasswordField
                      label="Current password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      autoComplete="current-password"
                    />
                    <PasswordField
                      label="New password"
                      value={newPassword}
                      onChange={setNewPassword}
                      autoComplete="new-password"
                    />
                    <PasswordField
                      label="Confirm new password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                    />
                    {passwordError ? (
                      <p className="text-sm text-red-700">{passwordError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={onSavePassword}
                      disabled={!canSavePassword}
                      className="self-start bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {passwordPending ? "Saving…" : "Save password"}
                    </button>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {section === "login-activity" ? (
              <SectionShell
                title="Login activity"
                description="Recent successful sign-ins for this account."
              >
                {loginActivity.length === 0 ? (
                  <p className="text-sm text-zinc-600">
                    No login activity recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-[11px] tracking-wide text-zinc-500 uppercase">
                          <th className="px-2 py-2 font-medium">When</th>
                          <th className="px-2 py-2 font-medium">IP</th>
                          <th className="px-2 py-2 font-medium">Device</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginActivity.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-zinc-100 align-top"
                          >
                            <td className="px-2 py-2 whitespace-nowrap text-zinc-800">
                              <LoginActivityWhen iso={item.occurredAt} />
                            </td>
                            <td className="px-2 py-2 font-mono text-[12px] text-zinc-600">
                              {item.ipAddress || "—"}
                            </td>
                            <td className="px-2 py-2 text-zinc-600">
                              <span className="line-clamp-2">
                                {item.userAgent || "—"}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-zinc-700">
                              {item.success ? "Success" : "Failed"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionShell>
            ) : null}

            {section === "salary" ? (
              <SectionShell
                title="Salary"
                description="Your personal salary record."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Amount
                    </span>
                    <input
                      value={salaryForm.amount}
                      onChange={(event) =>
                        setSalaryForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Currency
                    </span>
                    <input
                      value={salaryForm.currency}
                      onChange={(event) =>
                        setSalaryForm((current) => ({
                          ...current,
                          currency: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Pay frequency
                    </span>
                    <select
                      value={salaryForm.payFrequency}
                      onChange={(event) =>
                        setSalaryForm((current) => ({
                          ...current,
                          payFrequency: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Effective from
                    </span>
                    <input
                      type="date"
                      value={salaryForm.effectiveFrom}
                      onChange={(event) =>
                        setSalaryForm((current) => ({
                          ...current,
                          effectiveFrom: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Notes
                    </span>
                    <textarea
                      value={salaryForm.notes}
                      onChange={(event) =>
                        setSalaryForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                </div>
              </SectionShell>
            ) : null}

            {section === "contract" ? (
              <SectionShell
                title="Contract"
                description="Your employment contract summary."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Title
                    </span>
                    <input
                      value={contractForm.title}
                      onChange={(event) =>
                        setContractForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Employment contract"
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Status
                    </span>
                    <select
                      value={contractForm.status}
                      onChange={(event) =>
                        setContractForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="ended">Ended</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Start date
                    </span>
                    <input
                      type="date"
                      value={contractForm.startDate}
                      onChange={(event) =>
                        setContractForm((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      End date
                    </span>
                    <input
                      type="date"
                      value={contractForm.endDate}
                      onChange={(event) =>
                        setContractForm((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Notes
                    </span>
                    <textarea
                      value={contractForm.notes}
                      onChange={(event) =>
                        setContractForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                </div>
              </SectionShell>
            ) : null}

            {section === "actions" ? (
              <SectionShell
                title="Actions"
                description="Account actions for this signed-in user."
              >
                <div className="space-y-3">
                  <div className="border border-zinc-200 px-3 py-3">
                    <p className="text-sm font-medium text-zinc-900">
                      Sign out
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      End this session and return to the login screen.
                    </p>
                    <form action={logout} className="mt-3">
                      <button
                        type="submit"
                        className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                      >
                        Sign out now
                      </button>
                    </form>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {error ? (
              <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
        <h2 className="font-display text-base font-semibold text-zinc-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </>
  );
}
