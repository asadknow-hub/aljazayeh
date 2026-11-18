"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  STAFF_ASSIGNABLE_ROLES,
  departmentLabel,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import { createStaffAction, deleteStaffAction } from "@/lib/staff/actions";
import {
  STAFF_STATUSES,
  formatStaffSalary,
  type StaffProfileInput,
  type StaffStatus,
  type StaffView,
} from "@/lib/staff/types";
import { unwrap } from "@/lib/actions/result";

type StaffClientProps = {
  org: {
    id: string;
    name: string;
    code: string;
  };
  initialStaff: StaffView[];
};

const emptyForm: StaffProfileInput = {
  fullName: "",
  email: "",
  phone: "",
  jobTitle: "",
  employeeCode: "",
  joinedOn: "",
  status: "active",
  notes: "",
  departmentKeys: [],
};

function statusLabel(status: StaffStatus) {
  return STAFF_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function StaffClient({ org, initialStaff }: StaffClientProps) {
  usePageTitle("Staff");
  const router = useRouter();

  const [staff, setStaff] = useState(initialStaff);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [form, setForm] = useState<StaffProfileInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffView | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((item) => {
      const deptText = item.departmentKeys
        .map((key) => departmentLabel(key))
        .join(" ")
        .toLowerCase();
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.jobTitle.toLowerCase().includes(q) ||
        item.employeeCode.toLowerCase().includes(q) ||
        deptText.includes(q)
      );
    });
  }, [staff, query]);

  const canCreate =
    form.fullName.trim().length > 0 &&
    form.departmentKeys.length > 0 &&
    !pending;

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setCreateSuccess(false);
    setCreatedName("");
    setEditorOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setEditorOpen(false);
    setForm(emptyForm);
    setError(null);
    setCreateSuccess(false);
    setCreatedName("");
  }

  function openStaff(item: StaffView) {
    router.push(`/${org.code}/staff/${item.id}`);
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, item: StaffView) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openStaff(item);
    }
  }

  function toggleDepartment(key: StaffRoleKey) {
    setForm((current) => {
      const exists = current.departmentKeys.includes(key);
      return {
        ...current,
        departmentKeys: exists
          ? current.departmentKeys.filter((item) => item !== key)
          : [...current.departmentKeys, key],
      };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) {
      setError("Full name and at least one department are required.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(createStaffAction(org.code, form));
      setStaff((current) =>
        [...current, created].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        ),
      );
      setCreatedName(created.fullName);
      setCreateSuccess(true);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save staff.");
    } finally {
      setPending(false);
    }
  }

  function requestDelete(item: StaffView, event: MouseEvent) {
    event.stopPropagation();
    setPendingDelete(item);
    setError(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setDeletingId(item.id);
    try {
      await unwrap(deleteStaffAction(org.code, item.id));
      setStaff((current) => current.filter((row) => row.id !== item.id));
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete staff.");
      setPendingDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Staff
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Create and manage people for {org.name}, assigned to departments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
        >
          Add staff
        </button>
      </div>

      <div className="mb-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, title, department…"
          className="w-full max-w-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
        />
      </div>

      {error && !editorOpen ? (
        <div className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto border border-zinc-300 bg-white">
        <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] tracking-wide text-zinc-500 uppercase">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Departments</th>
              <th className="px-3 py-2 font-medium">Salary</th>
              <th className="px-3 py-2 font-medium">Last salary paid on</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-zinc-500"
                >
                  {staff.length === 0
                    ? "No staff yet. Add the first person."
                    : "No staff match this search."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openStaff(item)}
                  onKeyDown={(event) => onRowKeyDown(event, item)}
                  className="cursor-pointer border-b border-zinc-100 align-top last:border-b-0 transition hover:bg-zinc-50"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-900">{item.fullName}</p>
                    {item.employeeCode ? (
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {item.employeeCode}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {item.jobTitle || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.departmentKeys.length === 0 ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        item.departmentKeys.map((key) => (
                          <span
                            key={key}
                            className="border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-700"
                          >
                            {departmentLabel(key)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-700">
                    {formatStaffSalary(item.salaryAmount, item.salaryCurrency)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-700">
                    {item.lastSalaryPaidOn || "—"}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {statusLabel(item.status)}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={(event) => requestDelete(item, event)}
                      disabled={deletingId === item.id}
                      className="border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-45"
                    >
                      {deletingId === item.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-editor-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-auto border border-zinc-300 bg-white shadow-lg"
          >
            {createSuccess ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="staff-editor-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Staff created
                  </h3>
                </div>
                <div className="px-4 py-5 sm:px-5">
                  <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <p>
                      Staff created successfully
                      {createdName ? (
                        <>
                          {" "}
                          — <span className="font-medium">{createdName}</span>
                        </>
                      ) : null}
                      .
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="staff-editor-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Add staff
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Departments are required. Management is the admin role.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Full name
                    </span>
                    <input
                      value={form.fullName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      required
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Job title
                    </span>
                    <input
                      value={form.jobTitle}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          jobTitle: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Employee code
                    </span>
                    <input
                      value={form.employeeCode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employeeCode: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Joining date
                    </span>
                    <input
                      type="date"
                      value={form.joinedOn}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          joinedOn: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Email
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Phone
                    </span>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as StaffStatus,
                        }))
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      {STAFF_STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Notes
                    </span>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>

                  <fieldset className="sm:col-span-2">
                    <legend className="text-[12px] font-medium text-zinc-700">
                      Departments <span className="text-red-600">*</span>
                    </legend>
                    <p className="mt-1 text-xs text-zinc-500">
                      Required. Choose one or more roles/departments.
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {STAFF_ASSIGNABLE_ROLES.map((role) => {
                        const checked = form.departmentKeys.includes(role.key);
                        return (
                          <label
                            key={role.key}
                            className="flex cursor-pointer items-center gap-2 border border-zinc-200 px-3 py-2 text-sm text-zinc-800 transition hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDepartment(role.key)}
                              className="accent-header"
                            />
                            <span>{role.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                {error ? (
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={pending}
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canCreate}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {pending ? "Saving…" : "Create staff"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        title="Delete staff"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.fullName}? This cannot be undone.`
            : ""
        }
        pending={Boolean(deletingId)}
        onCancel={() => {
          if (!deletingId) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </main>
  );
}
