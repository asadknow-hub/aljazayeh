import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/header/app-header";
import { AppProviders } from "@/components/providers/app-providers";
import { getSession } from "@/lib/auth/session";
import { listUserOrganizations } from "@/lib/org/queries";

export const instant = false;

async function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const organizations = await listUserOrganizations(session.userId);

  return (
    <AppProviders
      initialOrganizations={organizations.map((org) => ({
        id: org.id,
        name: org.name,
        code: org.code,
        createdAt: org.createdAt.toISOString(),
        isDefault: org.isDefault,
      }))}
    >
      <AppHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </AppProviders>
  );
}

function AppShellFallback() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center text-sm text-zinc-500">
      Loading…
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}
