"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1.5 text-left">
        <span className="field-label">Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          className="field h-11"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-left">
        <span className="field-label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field h-11"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1 h-11"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
