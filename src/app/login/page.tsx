import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export const instant = false;

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-sm tracking-[0.2em] text-zinc-500 uppercase">
            Internal System
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            AlJazayeh
          </h1>
          <p className="text-sm leading-6 text-zinc-600">
            Sign in to continue
          </p>
        </div>

        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
