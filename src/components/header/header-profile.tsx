import { ProfileMenu } from "@/components/header/profile-menu";
import { getSession } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/profile/queries";

export async function HeaderProfile() {
  const session = await getSession();

  if (!session) {
    return (
      <div
        className="h-8 w-8 rounded-full border border-header-muted/35 bg-header-control"
        aria-hidden
      />
    );
  }

  const display = await getUserDisplayName(session.userId);
  const fullName =
    display?.fullName.trim() || display?.username || session.username;

  return <ProfileMenu fullName={fullName} />;
}
