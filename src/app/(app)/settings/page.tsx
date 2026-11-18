import { notFound, redirect } from "next/navigation";
import { ProfileSettingsClient } from "@/app/(app)/settings/profile-settings-client";
import { getSession } from "@/lib/auth/session";
import { getProfileSettingsBundle } from "@/lib/profile/queries";
import { resolveProfileSection } from "@/lib/profile/types";

export const instant = false;

type SettingsSearch = {
  section?: string | string[];
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SettingsSearch>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const rawSection = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  const initialSection = resolveProfileSection(rawSection);

  const bundle = await getProfileSettingsBundle(session.userId);
  if (!bundle) {
    notFound();
  }

  return (
    <ProfileSettingsClient
      initialSection={initialSection}
      initialBundle={bundle}
    />
  );
}
