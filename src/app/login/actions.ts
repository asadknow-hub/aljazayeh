"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateUser } from "@/lib/auth/authenticate";
import { clearSession, setSession } from "@/lib/auth/session";
import { companyPath } from "@/lib/org/code";
import { getDefaultOrganization } from "@/lib/org/queries";
import { recordSuccessfulLogin } from "@/lib/profile/queries";

export type LoginState = {
  error?: string;
};

function safeNextPath(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.startsWith("/login")) return null;
  return next;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const user = await authenticateUser(username, password);
  if (!user) {
    return { error: "Invalid username or password." };
  }

  await setSession({
    userId: user.userId,
    username: user.username,
  });

  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for");
    const ipAddress =
      forwarded?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "local";
    const userAgent = requestHeaders.get("user-agent") || "unknown";
    await recordSuccessfulLogin(user.userId, { ipAddress, userAgent });
  } catch (error) {
    console.error("Failed to record login activity", error);
  }

  if (next) {
    redirect(next);
  }

  const defaultOrg = await getDefaultOrganization(user.userId);
  if (defaultOrg) {
    redirect(companyPath(defaultOrg.code));
  }

  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
