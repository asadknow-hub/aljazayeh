import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export const instant = false;

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <section className="flex flex-col justify-between gap-10 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
        <p className="text-sm font-medium tracking-[0.2em] text-blue-200 uppercase">
          Internal System
        </p>
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            AlJazayeh
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-blue-100">
            Every job in one place, from the first inquiry to the receipt:
            quotations, job cards, deliveries, invoices, attendance and
            approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {["Inquiries", "Approvals", "Attendance", "Staff"].map((item) => (
            <span
              key={item}
              className="rounded-full bg-white/15 px-3 py-1 text-blue-50"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="card w-full max-w-sm p-7 shadow-lg">
          <h2 className="font-display text-2xl font-semibold text-slate-900">
            Sign in
          </h2>
          <p className="mt-1 mb-6 text-sm text-slate-600">
            Use the username and password given to you by the office.
          </p>
          <Suspense
            fallback={<p className="text-sm text-slate-500">Loading…</p>}
          >
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
