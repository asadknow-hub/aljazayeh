import { getSession } from "@/lib/auth/session";
import { getInquiryAttachmentForUser } from "@/lib/inquiries/queries";

/** An uploaded file, shown to people who may open the inquiry it is on. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgCode: string; fileId: string }> },
) {
  const { orgCode, fileId } = await params;
  const session = await getSession();
  const file = session
    ? await getInquiryAttachmentForUser(session.userId, orgCode, fileId)
    : null;
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
