"use client";

import { useState, type FormEvent } from "react";
import { AlertIcon } from "@/components/ui/icons";
import { MAX_TITLE_LENGTH } from "@/lib/organization/chart";
import type {
  OrganizationChart,
  PositionCandidate,
} from "@/lib/organization/types";

const OTHER = "";

/**
 * The small form a position is added or changed with: what it is called and
 * who holds it. When adding to a department, a position the forms call for
 * that is not on the chart yet can be picked instead of typing a title.
 */
export function PositionForm({
  heading,
  initial,
  department,
  roles = [],
  candidates,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: { title: string; staffId: string };
  /** The department it belongs to, whose people are offered first. */
  department?: { key: string; label: string };
  /** Positions the forms call for that the chart does not have. */
  roles?: OrganizationChart["unfilledRoles"];
  candidates: PositionCandidate[];
  pending: boolean;
  error: string | null;
  onSubmit: (value: {
    title: string;
    staffId: string;
    signsAs: string;
  }) => void;
  onCancel: () => void;
}) {
  const [signsAs, setSignsAs] = useState(roles[0]?.key ?? OTHER);
  const [title, setTitle] = useState(initial.title || roles[0]?.title || "");
  const [staffId, setStaffId] = useState(initial.staffId);

  const role = roles.find((item) => item.key === signsAs);
  const inside = department
    ? candidates.filter((person) =>
        person.departmentKeys.includes(department.key),
      )
    : [];
  const others = candidates.filter((person) => !inside.includes(person));
  const option = (person: PositionCandidate) => (
    <option key={person.id} value={person.id}>
      {person.fullName}
      {person.jobTitle ? ` · ${person.jobTitle}` : ""}
    </option>
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ title, staffId, signsAs });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-left">
      <p className="text-sm font-semibold text-slate-900">{heading}</p>

      {roles.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Position</span>
          <select
            value={signsAs}
            disabled={pending}
            onChange={(event) => {
              const next = roles.find(
                (item) => item.key === event.target.value,
              );
              setSignsAs(next?.key ?? OTHER);
              setTitle(next?.title ?? "");
            }}
            className="field w-full"
          >
            {roles.map((item) => (
              <option key={item.key} value={item.key}>
                {item.title}
              </option>
            ))}
            <option value={OTHER}>Another position</option>
          </select>
          {role ? (
            <span className="text-xs text-slate-500">
              Signs: {role.signs.join(", ")}.
            </span>
          ) : null}
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="field-label">Title</span>
        <input
          required
          autoFocus
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
          className="field w-full"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">Held by</span>
        <select
          value={staffId}
          disabled={pending}
          onChange={(event) => setStaffId(event.target.value)}
          className="field w-full"
        >
          <option value="">Nobody yet</option>
          {inside.length > 0 ? (
            <>
              <optgroup label={`In ${department!.label}`}>
                {inside.map(option)}
              </optgroup>
              <optgroup label="Everyone else">{others.map(option)}</optgroup>
            </>
          ) : (
            others.map(option)
          )}
        </select>
        <span className="text-xs text-slate-500">
          Staff with a login. They sign with their own signature and PIN.
        </span>
      </label>

      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
