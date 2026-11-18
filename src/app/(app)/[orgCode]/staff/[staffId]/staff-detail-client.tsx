"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import { StaffLoginSection } from "@/app/(app)/[orgCode]/staff/[staffId]/staff-login-section";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  formatFriendlyDateTime,
  formatLeavePeriod,
} from "@/lib/datetime/format";
import {
  STAFF_ASSIGNABLE_ROLES,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import {
  deleteStaffAction,
  updateStaffContractAction,
  updateStaffProfileAction,
  updateStaffSalaryAction,
} from "@/lib/staff/actions";
import {
  STAFF_DETAIL_SECTIONS,
  STAFF_STATUSES,
  type StaffContractInput,
  type StaffDetailSection,
  type StaffProfileInput,
  type StaffSalaryInput,
  type StaffStatus,
  type StaffView,
} from "@/lib/staff/types";
import {
  filterVacationsByList,
  leaveTypeLabel,
  vacationStatusLabel,
  type VacationListFilter,
  type VacationRequestView,
} from "@/lib/vacation/types";
import { unwrap } from "@/lib/actions/result";

const SECTION_LABELS: Record<StaffDetailSection, string> = {
  profile: "Profile",
  salary: "Salary",
  contract: "Contract",
  vacation: "Vacation",
  login: "Login",
  actions: "Actions",
};

type StaffDetailClientProps = {
  org: { id: string; name: string; code: string };
  initialStaff: StaffView;
  initialVacations: VacationRequestView[];
  initialSection: StaffDetailSection;
  viewer: { staffId: string; canManageCompany: boolean };
};

export function StaffDetailClient({
  org,
  initialStaff,
  initialVacations: vacations,
  initialSection,
  viewer,
}: StaffDetailClientProps) {
  usePageTitle(initialStaff.fullName);
  const router = useRouter();
  const { showToast } = useToast();

  const [staff, setStaff] = useState(initialStaff);
  const [vacationFilter, setVacationFilter] =
    useState<VacationListFilter>("active");
  const [section, setSection] = useState<StaffDetailSection>(initialSection);
  const [profile, setProfile] = useState<StaffProfileInput>({
    fullName: initialStaff.fullName,
    email: initialStaff.email,
    phone: initialStaff.phone,
    homeCountryContact: initialStaff.homeCountryContact,
    passportNumber: initialStaff.passportNumber,
    jobTitle: initialStaff.jobTitle,
    employeeCode: initialStaff.employeeCode,
    joinedOn: initialStaff.joinedOn,
    status: initialStaff.status,
    notes: initialStaff.notes,
    departmentKeys: [...initialStaff.departmentKeys],
  });
  const [salary, setSalary] = useState<StaffSalaryInput>({
    salaryAmount: initialStaff.salaryAmount,
    salaryCurrency: initialStaff.salaryCurrency,
    payFrequency: initialStaff.payFrequency,
    lastSalaryPaidOn: initialStaff.lastSalaryPaidOn,
    salaryNotes: initialStaff.salaryNotes,
  });
  const [contract, setContract] = useState<StaffContractInput>({
    contractTitle: initialStaff.contractTitle,
    contractStatus: initialStaff.contractStatus,
    contractStartDate: initialStaff.contractStartDate,
    contractEndDate: initialStaff.contractEndDate,
    contractNotes: initialStaff.contractNotes,
  });
  const [savedProfile, setSavedProfile] = useState(profile);
  const [savedSalary, setSavedSalary] = useState(salary);
  const [savedContract, setSavedContract] = useState(contract);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const isDirty = useMemo(() => {
    if (section === "profile") {
      return JSON.stringify(profile) !== JSON.stringify(savedProfile);
    }
    if (section === "salary") {
      return JSON.stringify(salary) !== JSON.stringify(savedSalary);
    }
    if (section === "contract") {
      return JSON.stringify(contract) !== JSON.stringify(savedContract);
    }
    return false;
  }, [
    section,
    profile,
    savedProfile,
    salary,
    savedSalary,
    contract,
    savedContract,
  ]);

  const canSave =
    isDirty &&
    !pending &&
    section !== "login" &&
    section !== "actions" &&
    section !== "vacation";

  const visibleVacations = useMemo(
    () => filterVacationsByList(vacations, vacationFilter),
    [vacations, vacationFilter],
  );

  function selectSection(next: StaffDetailSection) {
    setSection(next);
    setError(null);
    router.replace(`/${org.code}/staff/${staff.id}?section=${next}`, {
      scroll: false,
    });
  }

  function onCancel() {
    router.push(`/${org.code}/staff`);
  }

  function toggleDepartment(key: StaffRoleKey) {
    setProfile((current) => {
      const exists = current.departmentKeys.includes(key);
      return {
        ...current,
        departmentKeys: exists
          ? current.departmentKeys.filter((item) => item !== key)
          : [...current.departmentKeys, key],
      };
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setError(null);
    setPending(true);
    try {
      if (section === "profile") {
        const updated = await unwrap(updateStaffProfileAction(
          org.code,
          staff.id,
          profile,
        ));
        setStaff(updated);
        const nextProfile: StaffProfileInput = {
          fullName: updated.fullName,
          email: updated.email,
          phone: updated.phone,
          homeCountryContact: updated.homeCountryContact,
          passportNumber: updated.passportNumber,
          jobTitle: updated.jobTitle,
          employeeCode: updated.employeeCode,
          joinedOn: updated.joinedOn,
          status: updated.status,
          notes: updated.notes,
          departmentKeys: [...updated.departmentKeys],
        };
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
        showToast("Profile saved");
      } else if (section === "salary") {
        const updated = await unwrap(updateStaffSalaryAction(
          org.code,
          staff.id,
          salary,
        ));
        setStaff(updated);
        const nextSalary: StaffSalaryInput = {
          salaryAmount: updated.salaryAmount,
          salaryCurrency: updated.salaryCurrency,
          payFrequency: updated.payFrequency,
          lastSalaryPaidOn: updated.lastSalaryPaidOn,
          salaryNotes: updated.salaryNotes,
        };
        setSalary(nextSalary);
        setSavedSalary(nextSalary);
        showToast("Salary saved");
      } else if (section === "contract") {
        const updated = await unwrap(updateStaffContractAction(
          org.code,
          staff.id,
          contract,
        ));
        setStaff(updated);
        const nextContract: StaffContractInput = {
          contractTitle: updated.contractTitle,
          contractStatus: updated.contractStatus,
          contractStartDate: updated.contractStartDate,
          contractEndDate: updated.contractEndDate,
          contractNotes: updated.contractNotes,
        };
        setContract(nextContract);
        setSavedContract(nextContract);
        showToast("Contract saved");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    setDeletePending(true);
    try {
      await unwrap(deleteStaffAction(org.code, staff.id));
      setDeleteOpen(false);
      router.push(`/${org.code}/staff`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete staff.");
      setDeleteOpen(false);
      setDeletePending(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none fixed top-14 right-4 z-30 sm:right-6">
        <div className="pointer-events-auto flex items-center gap-2 border border-slate-200 bg-white px-2 py-1.5 shadow-sm rounded-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="staff-detail-form"
            disabled={!canSave}
            className="btn btn-primary"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white sm:w-56">
          <div className="border-b border-slate-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-slate-900">
              {staff.fullName}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {staff.jobTitle || "Staff member"}
            </p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {STAFF_DETAIL_SECTIONS.map((item) => {
              const active = item === section;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectSection(item)}
                  className={[
                    "cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {SECTION_LABELS[item]}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <form
            id="staff-detail-form"
            onSubmit={onSave}
            className="card w-full max-w-3xl"
          >
            {section === "profile" ? (
              <SectionShell
                title="Profile"
                description="Identity and department roles for this staff member."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Full name
                    </span>
                    <input
                      value={profile.fullName}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Email
                    </span>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Phone
                    </span>
                    <input
                      value={profile.phone}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Home country contact number
                    </span>
                    <input
                      value={profile.homeCountryContact}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          homeCountryContact: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Passport number
                    </span>
                    <input
                      value={profile.passportNumber}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          passportNumber: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Profession
                    </span>
                    <input
                      value={profile.jobTitle}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          jobTitle: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Employee code
                    </span>
                    <input
                      value={profile.employeeCode}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          employeeCode: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Joining date
                    </span>
                    <input
                      type="date"
                      value={profile.joinedOn}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          joinedOn: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Status
                    </span>
                    <select
                      value={profile.status}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          status: event.target.value as StaffStatus,
                        }))
                      }
                      className="field"
                    >
                      {STAFF_STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Notes
                    </span>
                    <textarea
                      value={profile.notes}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="field"
                    />
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="field-label">
                      Departments <span className="text-red-600">*</span>
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {STAFF_ASSIGNABLE_ROLES.map((role) => (
                        <label
                          key={role.key}
                          className="flex cursor-pointer items-center gap-2 border border-slate-200 px-3 py-2 text-sm rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={profile.departmentKeys.includes(role.key)}
                            onChange={() => toggleDepartment(role.key)}
                            className="accent-header"
                          />
                          <span>{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </SectionShell>
            ) : null}

            {section === "salary" ? (
              <SectionShell
                title="Salary"
                description="Compensation details visible on this staff record."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Salary amount
                    </span>
                    <input
                      value={salary.salaryAmount}
                      onChange={(event) =>
                        setSalary((current) => ({
                          ...current,
                          salaryAmount: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Currency
                    </span>
                    <input
                      value={salary.salaryCurrency}
                      onChange={(event) =>
                        setSalary((current) => ({
                          ...current,
                          salaryCurrency: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Pay frequency
                    </span>
                    <select
                      value={salary.payFrequency}
                      onChange={(event) =>
                        setSalary((current) => ({
                          ...current,
                          payFrequency: event.target.value,
                        }))
                      }
                      className="field"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Last salary paid on
                    </span>
                    <input
                      type="date"
                      value={salary.lastSalaryPaidOn}
                      onChange={(event) =>
                        setSalary((current) => ({
                          ...current,
                          lastSalaryPaidOn: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Notes
                    </span>
                    <textarea
                      value={salary.salaryNotes}
                      onChange={(event) =>
                        setSalary((current) => ({
                          ...current,
                          salaryNotes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="field"
                    />
                  </label>
                </div>
              </SectionShell>
            ) : null}

            {section === "contract" ? (
              <SectionShell
                title="Contract"
                description="Employment contract summary for this staff member."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Title
                    </span>
                    <input
                      value={contract.contractTitle}
                      onChange={(event) =>
                        setContract((current) => ({
                          ...current,
                          contractTitle: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Status
                    </span>
                    <select
                      value={contract.contractStatus}
                      onChange={(event) =>
                        setContract((current) => ({
                          ...current,
                          contractStatus: event.target.value,
                        }))
                      }
                      className="field"
                    >
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="ended">Ended</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Start date
                    </span>
                    <input
                      type="date"
                      value={contract.contractStartDate}
                      onChange={(event) =>
                        setContract((current) => ({
                          ...current,
                          contractStartDate: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      End date
                    </span>
                    <input
                      type="date"
                      value={contract.contractEndDate}
                      onChange={(event) =>
                        setContract((current) => ({
                          ...current,
                          contractEndDate: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Notes
                    </span>
                    <textarea
                      value={contract.contractNotes}
                      onChange={(event) =>
                        setContract((current) => ({
                          ...current,
                          contractNotes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="field"
                    />
                  </label>
                </div>
              </SectionShell>
            ) : null}

            {section === "vacation" ? (
              <SectionShell
                title="Vacation"
                description="Vacation log for this staff member. Requests are started from Reception."
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVacationFilter("active")}
                    className={[
                      "border px-3 py-1.5 text-sm font-medium transition rounded-lg",
                      vacationFilter === "active"
                        ? "border-primary bg-primary text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setVacationFilter("completed")}
                    className={[
                      "border px-3 py-1.5 text-sm font-medium transition rounded-lg",
                      vacationFilter === "completed"
                        ? "border-primary bg-primary text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    Completed vacations
                  </button>
                  <button
                    type="button"
                    onClick={() => setVacationFilter("rejected")}
                    className={[
                      "border px-3 py-1.5 text-sm font-medium transition rounded-lg",
                      vacationFilter === "rejected"
                        ? "border-primary bg-primary text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    Rejected
                  </button>
                </div>

                {visibleVacations.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    {vacationFilter === "active"
                      ? "No active vacations."
                      : vacationFilter === "completed"
                        ? "No completed vacations yet."
                        : "No rejected vacation requests."}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {visibleVacations.map((item) => (
                      <li key={item.id} className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {leaveTypeLabel(item.leaveType)}
                          </p>
                          <span className="text-xs font-medium text-slate-500">
                            {vacationFilter === "completed"
                              ? "Completed"
                              : vacationStatusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatLeavePeriod(
                            item.startDate,
                            item.endDate,
                            item.dayCount,
                          )}
                        </p>
                        <Link
                          href={`/${org.code}/leave/${item.id}`}
                          className="mt-1 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Open leave form
                        </Link>
                        {item.reason ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Reason: {item.reason}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          Created{" "}
                          {formatFriendlyDateTime(new Date(item.createdAt))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionShell>
            ) : null}

            {section === "login" ? (
              <SectionShell
                title="Login"
                description="Whether this person can sign in to the system."
              >
                <StaffLoginSection
                  orgCode={org.code}
                  staff={staff}
                  viewer={viewer}
                  onChange={setStaff}
                />
              </SectionShell>
            ) : null}

            {section === "actions" ? (
              <SectionShell
                title="Actions"
                description="Administrative actions for this staff record."
              >
                <div className="border border-red-200 px-3 py-3 rounded-lg">
                  <p className="text-sm font-medium text-slate-900">
                    Delete staff
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Only for records created by mistake. Someone who has a
                    login or any history is set to Inactive on the Profile tab
                    instead.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    disabled={pending || deletePending}
                    className="mt-3 border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-45 rounded-lg"
                  >
                    Delete staff
                  </button>
                </div>
              </SectionShell>
            ) : null}

            {error ? (
              <div className="border-t border-slate-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete staff"
        message={`Delete ${staff.fullName}? This cannot be undone.`}
        pending={deletePending}
        onCancel={() => {
          if (!deletePending) setDeleteOpen(false);
        }}
        onConfirm={confirmDelete}
      />
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
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </>
  );
}
