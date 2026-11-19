import "server-only";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import { inquiryAttachments } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

/** Largest file accepted: a scanned page or a photo fits comfortably. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Kinds of file that can be uploaded and shown back safely. */
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export type AttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
};

/** Check an uploaded file and return what is stored of it. */
export function readUploadedFile(input: { fileName: string; dataUrl: string }) {
  const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    input.dataUrl ?? "",
  );
  if (!match || !ALLOWED_TYPES.includes(match[1]!)) {
    throw new UserError("Upload a PDF, or a JPG or PNG picture.");
  }
  const content = match[2]!;
  const sizeBytes = Math.floor((content.length * 3) / 4);
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new UserError("The file is too large. Use one under 5 MB.");
  }
  const fileName =
    String(input.fileName ?? "")
      .replace(/[\\/\u0000-\u001f"]/g, "")
      .trim()
      .slice(0, 150) || "file";
  return { fileName, contentType: match[1]!, sizeBytes, content };
}

export async function insertAttachment(
  tx: DbTransaction,
  values: typeof inquiryAttachments.$inferInsert,
): Promise<AttachmentView> {
  const [row] = await tx.insert(inquiryAttachments).values(values).returning({
    id: inquiryAttachments.id,
    fileName: inquiryAttachments.fileName,
    contentType: inquiryAttachments.contentType,
  });
  return row!;
}

/** The files of an inquiry, without their contents. */
export async function listAttachments(
  tx: DbTransaction,
  inquiryId: string,
): Promise<AttachmentView[]> {
  return tx
    .select({
      id: inquiryAttachments.id,
      fileName: inquiryAttachments.fileName,
      contentType: inquiryAttachments.contentType,
    })
    .from(inquiryAttachments)
    .where(eq(inquiryAttachments.inquiryId, inquiryId));
}

/**
 * Keep only the files a step still refers to. A file that was uploaded and
 * then replaced, or never saved, is removed.
 */
export async function keepOnlyAttachments(
  tx: DbTransaction,
  inquiryId: string,
  stageKey: string,
  keepIds: string[],
) {
  const ids = keepIds.filter(isUuid);
  if (ids.length > 0) {
    const found = await tx
      .select({ id: inquiryAttachments.id })
      .from(inquiryAttachments)
      .where(
        and(
          eq(inquiryAttachments.inquiryId, inquiryId),
          inArray(inquiryAttachments.id, ids),
        ),
      );
    if (found.length !== new Set(ids).size) {
      throw new UserError("The uploaded file was not found. Upload it again.");
    }
  }
  await tx
    .delete(inquiryAttachments)
    .where(
      and(
        eq(inquiryAttachments.inquiryId, inquiryId),
        eq(inquiryAttachments.stageKey, stageKey),
        ids.length > 0 ? notInArray(inquiryAttachments.id, ids) : undefined,
      ),
    );
}

/** One file with its contents, for showing or downloading it. */
export async function loadAttachmentFile(userId: string, attachmentId: string) {
  if (!isUuid(attachmentId)) return null;
  return withTenantContext(userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(inquiryAttachments)
      .where(eq(inquiryAttachments.id, attachmentId))
      .limit(1);
    return row ?? null;
  });
}
