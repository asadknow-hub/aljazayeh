"use client";

import Link from "next/link";
import { DepartmentIcon } from "@/components/departments/department-icons";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { departmentPath, type Department } from "@/lib/departments/catalog";

type CompanyHomeClientProps = {
  org: { name: string; code: string };
  /** Departments this person is allowed to open. */
  tiles: Department[];
  /** Work waiting on this person: their inquiries and documents to sign. */
  tasks: { href: string; title: string; detail: string; action: string }[];
};

export function CompanyHomeClient({
  org,
  tiles,
  tasks,
}: CompanyHomeClientProps) {
  usePageTitle("Select Department");

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((dept) => (
          <Link
            key={dept.key}
            href={departmentPath(org.code, dept.slug)}
            className="group flex flex-col items-center gap-3 text-center outline-none"
          >
            <span
              // A light tint of the department's own colour.
              style={{ backgroundColor: `${dept.accent}14` }}
              className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl shadow-[0_2px_10px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 transition duration-200 group-hover:shadow-[0_8px_20px_rgba(15,23,42,0.12)] group-hover:ring-slate-300 group-focus-visible:ring-2 group-focus-visible:ring-primary sm:h-24 sm:w-24"
            >
              <DepartmentIcon
                departmentKey={dept.key}
                accent={dept.accent}
                className="h-12 w-12 sm:h-14 sm:w-14"
              />
            </span>
            <span className="max-w-[9.5rem] font-display text-[15px] font-semibold leading-snug text-slate-800 transition group-hover:text-slate-950 sm:text-base">
              {dept.label}
            </span>
          </Link>
        ))}
      </div>

      <section className="mx-auto mt-12 w-full max-w-5xl">
        <div className="card">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              My Tasks
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Inquiries assigned to you and documents waiting for your
              signature.
            </p>
          </div>

          {tasks.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-600 sm:px-5">
              Nothing is waiting for you right now.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {tasks.map((task) => (
                <li key={task.href}>
                  <Link
                    href={task.href}
                    className="flex flex-col gap-1 px-4 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {task.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-600">
                        {task.detail}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-primary">
                      {task.action}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
