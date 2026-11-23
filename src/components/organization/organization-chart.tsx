"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { PositionForm } from "@/components/organization/position-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import { DEPARTMENTS } from "@/lib/departments/catalog";
import {
  addPositionAction,
  moveOwnerAction,
  removePositionAction,
  setDepartmentInUseAction,
  updatePositionAction,
} from "@/lib/organization/actions";
import { ACCOUNTS_DEPARTMENT, MAX_OWNERS } from "@/lib/organization/chart";
import type { ChartChange } from "@/lib/organization/queries";
import type {
  ChartDepartment,
  ChartPosition,
  OrganizationChart,
} from "@/lib/organization/types";
import { OWNERS_BLOCK } from "@/lib/signoffs/chains";

/** What is open for changing; one thing at a time. */
type Open =
  | { kind: "edit" | "remove"; id: string }
  | { kind: "add"; block: string }
  | { kind: "close"; department: string }
  | null;

const OWNER_COLOR = "#1e3a8a";
const colorOf = (department: string) =>
  DEPARTMENTS.find((item) => item.key === department)?.accent ?? "#475569";

const line = "bg-slate-300";
const actionLink =
  "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-40";

function countLabel(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** What the paperwork asks of a position, in a line or two. */
function Duties({ position }: { position: ChartPosition }) {
  const owner = position.block === OWNERS_BLOCK;
  if (position.signs.length === 0 && position.approves.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Signs no form. Can be chosen to approve an inquiry step.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs text-slate-600">
      {position.signs.length > 0 ? (
        <p>
          <span className="font-medium text-slate-700">Signs:</span>{" "}
          {owner ? "every form" : position.signs.join(", ")}
        </p>
      ) : null}
      {position.approves.length > 0 ? (
        <p>
          <span className="font-medium text-slate-700">
            {owner ? "Approves, with the other owners:" : "Approves:"}
          </span>{" "}
          {position.approves.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function Holder({ position }: { position: ChartPosition }) {
  if (!position.staffId) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800">
        <AlertIcon className="h-4 w-4" />
        Nobody named yet
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm text-slate-900">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
        {position.staffName.charAt(0).toUpperCase()}
      </span>
      <span className="truncate">{position.staffName}</span>
    </p>
  );
}

/** What taking a position off the chart does, said before it is done. */
function removalEffects(position: ChartPosition): string[] {
  const owner = position.block === OWNERS_BLOCK;
  return [
    owner
      ? "Every form loses the box for this owner."
      : position.signs.length > 0
        ? `Its box comes off: ${position.signs.join(", ")}.`
        : "",
    !owner && position.approves.length > 0
      ? `${position.approves.join(", ")} will need no approval.`
      : "",
    "Forms that were only waiting for it are approved.",
  ].filter(Boolean);
}

function ConfirmRemove({
  question,
  effects,
  pending,
  error,
  onYes,
  onNo,
}: {
  question: string;
  effects: string[];
  pending: boolean;
  error: string | null;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <p className="text-sm font-semibold text-slate-900">{question}</p>
      <ul className="list-disc pl-4 text-xs text-slate-600">
        {effects.map((effect) => (
          <li key={effect}>{effect}</li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onYes}
          className="btn btn-danger btn-sm"
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onNo}
          className="btn btn-secondary btn-sm"
        >
          No
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * The organisation chart: the owners, Accounts under them, the other
 * departments under Accounts, each with its positions and who holds them.
 * An administrator changes it here; the forms and the inquiry steps take
 * their people from it.
 */
export function OrganizationChartClient({
  orgCode,
  initialChart,
}: {
  orgCode: string;
  initialChart: OrganizationChart;
}) {
  usePageTitle("Organization");
  const router = useRouter();
  const { showToast } = useToast();
  const [chart, setChart] = useState(initialChart);
  const [open, setOpen] = useState<Open>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { canEdit } = chart;
  const accounts = chart.departments.find(
    (item) => item.key === ACCOUNTS_DEPARTMENT,
  );
  const others = chart.departments.filter(
    (item) => item.key !== ACCOUNTS_DEPARTMENT,
  );
  const vacant = [
    ...chart.owners,
    ...chart.departments.flatMap((item) => item.positions),
  ].filter(
    (position) =>
      !position.staffId &&
      (position.signs.length > 0 || position.approves.length > 0),
  );

  function show(next: Open) {
    setError(null);
    setOpen(next);
  }

  /** Make a change, then show the chart as it now stands. */
  async function run(
    work: () => Promise<ActionResult<ChartChange>>,
    done: string,
  ) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const change = await unwrap(work());
      setChart(change.chart);
      setOpen(null);
      showToast(
        change.settled > 0
          ? `${done}. ${countLabel(change.settled, "form")} that only waited for it ${change.settled === 1 ? "is" : "are"} approved.`
          : done,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  /** A position: as it stands, being changed, or being removed. */
  function position(item: ChartPosition, department?: ChartDepartment) {
    const owner = item.block === OWNERS_BLOCK;
    const index = chart.owners.indexOf(item);

    if (open?.kind === "edit" && open.id === item.id) {
      return (
        <PositionForm
          heading={owner ? "Change this owner" : "Change this position"}
          initial={{ title: item.title, staffId: item.staffId ?? "" }}
          department={department}
          candidates={chart.candidates}
          pending={pending}
          error={error}
          onCancel={() => show(null)}
          onSubmit={({ title, staffId }) =>
            run(
              () => updatePositionAction(orgCode, item.id, { title, staffId }),
              "Saved",
            )
          }
        />
      );
    }
    if (open?.kind === "remove" && open.id === item.id) {
      return (
        <ConfirmRemove
          question={`Take ${item.title} off the chart?`}
          effects={removalEffects(item)}
          pending={pending}
          error={error}
          onNo={() => show(null)}
          onYes={() =>
            run(
              () => removePositionAction(orgCode, item.id),
              `${item.title} removed`,
            )
          }
        />
      );
    }

    return (
      <div className="flex h-full flex-col gap-1.5 text-left">
        <p className="font-display text-[15px] leading-snug font-semibold text-slate-900">
          {owner ? (
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 align-[1px] text-[11px] font-semibold text-white">
              {index + 1}
            </span>
          ) : null}
          {item.title}
        </p>
        <Holder position={item} />
        <Duties position={item} />
        {canEdit ? (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => show({ kind: "edit", id: item.id })}
              className={actionLink}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Change
            </button>
            {owner && chart.owners.length === 1 ? null : (
              <button
                type="button"
                disabled={pending}
                onClick={() => show({ kind: "remove", id: item.id })}
                className={`${actionLink} hover:!bg-red-50 hover:!text-red-700`}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
            {owner && chart.owners.length > 1 ? (
              <span className="ml-auto flex">
                <IconButton
                  label="Signs earlier"
                  disabled={pending || index === 0}
                  onClick={() =>
                    run(
                      () => moveOwnerAction(orgCode, item.id, "earlier"),
                      "Order changed",
                    )
                  }
                >
                  <ArrowLeftIcon />
                </IconButton>
                <IconButton
                  label="Signs later"
                  disabled={pending || index === chart.owners.length - 1}
                  onClick={() =>
                    run(
                      () => moveOwnerAction(orgCode, item.id, "later"),
                      "Order changed",
                    )
                  }
                >
                  <ArrowRightIcon />
                </IconButton>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function addForm(block: string, department?: ChartDepartment) {
    return (
      <PositionForm
        heading={
          block === OWNERS_BLOCK
            ? "Add an owner"
            : `Add a position to ${department!.label}`
        }
        initial={{ title: "", staffId: "" }}
        department={department}
        roles={block === OWNERS_BLOCK ? [] : chart.unfilledRoles}
        candidates={chart.candidates}
        pending={pending}
        error={error}
        onCancel={() => show(null)}
        onSubmit={(value) =>
          run(() => addPositionAction(orgCode, { block, ...value }), "Added")
        }
      />
    );
  }

  function departmentCard(department: ChartDepartment) {
    const adding = open?.kind === "add" && open.block === department.key;
    const closing =
      open?.kind === "close" && open.department === department.key;
    const shown = department.staff.slice(0, 4);

    return (
      <section className="card flex h-full flex-col overflow-hidden">
        <div
          className="h-1.5 shrink-0"
          style={{ backgroundColor: colorOf(department.key) }}
        />
        <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {department.label}
          </h3>
          <span className="shrink-0 text-xs text-slate-500">
            {countLabel(department.staff.length, "person", "people")}
          </span>
        </div>
        {department.prepares.length > 0 ? (
          <p className="px-4 pt-1 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Prepares:</span>{" "}
            {department.prepares.join(", ")}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2 px-3 py-3">
          {department.positions.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"
            >
              {position(item, department)}
            </li>
          ))}
          {department.positions.length === 0 && !adding ? (
            <li className="px-1 text-xs text-slate-500">
              No positions. Nothing here signs or approves.
            </li>
          ) : null}
          {adding ? (
            <li className="rounded-lg border border-primary/40 bg-white px-3 py-2.5">
              {addForm(department.key, department)}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto flex flex-col gap-2 px-4 pb-3">
          {shown.length > 0 ? (
            <p className="text-xs text-slate-500">
              {shown.join(", ")}
              {department.staff.length > shown.length
                ? ` and ${department.staff.length - shown.length} more`
                : ""}
            </p>
          ) : null}
          {closing ? (
            <ConfirmRemove
              question={`The company has no ${department.label} department?`}
              effects={[
                "It comes off the chart and the home screen, with its positions.",
                "It can be added back at any time.",
              ]}
              pending={pending}
              error={error}
              onNo={() => show(null)}
              onYes={() =>
                run(
                  () =>
                    setDepartmentInUseAction(orgCode, department.key, false),
                  `${department.label} removed`,
                )
              }
            />
          ) : canEdit && !adding ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => show({ kind: "add", block: department.key })}
                className="btn btn-secondary btn-sm"
              >
                <PlusIcon />
                Add position
              </button>
              {department.key !== ACCOUNTS_DEPARTMENT ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    show({ kind: "close", department: department.key })
                  }
                  className="cursor-pointer text-xs font-medium text-slate-500 hover:text-red-700 hover:underline"
                >
                  Remove department
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const addingOwner = open?.kind === "add" && open.block === OWNERS_BLOCK;

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Organization
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Who holds which position. The company&apos;s forms take their
            signatures from here and the inquiry steps their approvers: add an
            owner and every form gets a box for them; take a position off and
            nothing asks for it any more.
            {canEdit ? "" : " Administrators change it."}
          </p>
        </header>

        {vacant.length > 0 ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Nobody is named for {vacant.map((item) => item.title).join(", ")}.
              What needs{" "}
              {vacant.length === 1 ? "that position" : "those positions"} is
              held up: forms that need the signature cannot be raised, and
              inquiry steps it approves cannot move on. Name somebody, or take
              the position off the chart.
            </span>
          </p>
        ) : null}
        {chart.unfilledRoles.length > 0 ? (
          <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Not on the chart, so the forms have no box for{" "}
            {chart.unfilledRoles.length === 1 ? "it" : "them"}:{" "}
            {chart.unfilledRoles
              .map((role) => `${role.title} (${role.signs.join(", ")})`)
              .join("; ")}
            .
            {canEdit
              ? " Add a position to a department to bring one back."
              : ""}
          </p>
        ) : null}

        {/* The owners. */}
        <div className="flex flex-col items-center">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Owners · {chart.owners.length} of up to {MAX_OWNERS}
          </p>
          <ul className="flex flex-wrap items-stretch justify-center gap-4">
            {chart.owners.map((item) => (
              <li
                key={item.id}
                className="card flex w-64 flex-col overflow-hidden"
              >
                <div
                  className="h-1.5 shrink-0"
                  style={{ backgroundColor: OWNER_COLOR }}
                />
                <div className="flex-1 px-4 py-3">{position(item)}</div>
              </li>
            ))}
            {addingOwner ? (
              <li className="card w-64 border-primary/40 px-4 py-3">
                {addForm(OWNERS_BLOCK)}
              </li>
            ) : canEdit && chart.owners.length < MAX_OWNERS ? (
              <li className="flex w-40">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => show({ kind: "add", block: OWNERS_BLOCK })}
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-3 py-4 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add owner
                </button>
              </li>
            ) : null}
          </ul>
          <div className={`h-8 w-px ${line}`} />
        </div>

        {/* Accounts, directly under the owners. */}
        {accounts ? (
          <div className="flex flex-col items-center">
            <div className="w-full max-w-sm">{departmentCard(accounts)}</div>
            {others.length > 0 ? <div className={`h-6 w-px ${line}`} /> : null}
          </div>
        ) : null}

        {/* Every other department, under Accounts. */}
        <ul
          style={{ "--columns": others.length } as CSSProperties}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(var(--columns),minmax(0,1fr))]"
        >
          {others.map((department, index) => (
            <li key={department.key} className="relative xl:pt-6">
              {/* The branch from Accounts down to this department. */}
              <span
                aria-hidden
                className={`absolute top-0 left-1/2 hidden h-6 w-px xl:block ${line}`}
              />
              {others.length > 1 ? (
                <span
                  aria-hidden
                  className={[
                    `absolute top-0 hidden h-px xl:block ${line}`,
                    index === 0 ? "left-1/2" : "-left-2",
                    index === others.length - 1 ? "right-1/2" : "-right-2",
                  ].join(" ")}
                />
              ) : null}
              {departmentCard(department)}
            </li>
          ))}
        </ul>

        {canEdit && chart.closedDepartments.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5">
            <span className="text-sm text-slate-600">Not in this company:</span>
            {chart.closedDepartments.map((department) => (
              <button
                key={department.key}
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      setDepartmentInUseAction(orgCode, department.key, true),
                    `${department.label} added`,
                  )
                }
                className="btn btn-secondary btn-sm"
              >
                <PlusIcon />
                Add {department.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
