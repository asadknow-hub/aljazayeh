"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useOrganizations } from "@/components/providers/org-provider";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import { saveCompanySettingsAction } from "@/lib/company-settings/actions";
import type { CompanySettingsView } from "@/lib/company-settings/types";
import { saveInquiryWorkflowMapAction } from "@/lib/inquiries/actions";
import {
  INQUIRY_APPROVAL_ROLES,
  INQUIRY_STAGES,
  INQUIRY_WORKFLOW_DEPARTMENTS,
  type InquiryApprovalRoleKey,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
  type InquiryWorkflowMap,
  type InquiryWorkflowStageConfig,
} from "@/lib/inquiries/stages";
import { companyPath } from "@/lib/org/code";
import { unwrap } from "@/lib/actions/result";

type FieldKey = Exclude<
  keyof CompanySettingsView,
  "organizationId" | "organizationCode"
>;

const EDITABLE_KEYS: FieldKey[] = [
  "companyName",
  "telephoneNumber",
  "phoneNumber",
  "whatsappNumber",
  "email",
  "websiteUrl",
  "instagramUrl",
  "facebookUrl",
  "adminName",
  "adminEmail",
  "attendanceSheetNotes",
];

function settingsEqual(
  left: CompanySettingsView,
  right: CompanySettingsView,
): boolean {
  return EDITABLE_KEYS.every((key) => left[key] === right[key]);
}

function workflowEqual(left: InquiryWorkflowMap, right: InquiryWorkflowMap) {
  return INQUIRY_STAGES.every((stage) => {
    const a = left[stage.key];
    const b = right[stage.key];
    return (
      a.departmentKey === b.departmentKey &&
      a.approvalRequired === b.approvalRequired &&
      a.approvalRequiredBy === b.approvalRequiredBy
    );
  });
}

type FieldConfig = {
  key: FieldKey;
  label: string;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  autoComplete?: string;
};

const CONTACT_FIELDS: FieldConfig[] = [
  {
    key: "companyName",
    label: "Company name",
    placeholder: "Al Jazayeh LLC",
    autoComplete: "organization",
  },
  {
    key: "telephoneNumber",
    label: "Telephone number",
    type: "tel",
    placeholder: "+971 4 000 0000",
    autoComplete: "tel",
  },
  {
    key: "phoneNumber",
    label: "Phone number",
    type: "tel",
    placeholder: "+971 50 000 0000",
    autoComplete: "tel-national",
  },
  {
    key: "whatsappNumber",
    label: "WhatsApp number",
    type: "tel",
    placeholder: "+971 50 000 0000",
  },
  {
    key: "email",
    label: "Email",
    type: "email",
    placeholder: "info@company.com",
    autoComplete: "email",
  },
  {
    key: "websiteUrl",
    label: "Website link",
    type: "url",
    placeholder: "https://www.company.com",
  },
  {
    key: "instagramUrl",
    label: "Instagram page",
    type: "url",
    placeholder: "https://instagram.com/company",
  },
  {
    key: "facebookUrl",
    label: "Facebook page",
    type: "url",
    placeholder: "https://facebook.com/company",
  },
];

const ADMIN_FIELDS: FieldConfig[] = [
  {
    key: "adminName",
    label: "Admin name",
    placeholder: "Full name",
    autoComplete: "name",
  },
  {
    key: "adminEmail",
    label: "Admin email",
    type: "email",
    placeholder: "admin@company.com",
    autoComplete: "email",
  },
];

type SettingsSection = "company" | "inquiry-settings";

type CompanySettingsClientProps = {
  initialSettings: CompanySettingsView;
  initialWorkflow: InquiryWorkflowMap;
  initialSection?: SettingsSection;
};

export function CompanySettingsClient({
  initialSettings,
  initialWorkflow,
  initialSection = "company",
}: CompanySettingsClientProps) {
  usePageTitle("Company Settings");
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshOrganizations, organizations } = useOrganizations();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [form, setForm] = useState<CompanySettingsView>(initialSettings);
  const [saved, setSaved] = useState<CompanySettingsView>(initialSettings);
  const [workflow, setWorkflow] = useState<InquiryWorkflowMap>(initialWorkflow);
  const [savedWorkflow, setSavedWorkflow] =
    useState<InquiryWorkflowMap>(initialWorkflow);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const companyDirty = useMemo(
    () => !settingsEqual(form, saved),
    [form, saved],
  );
  const workflowDirty = useMemo(
    () => !workflowEqual(workflow, savedWorkflow),
    [workflow, savedWorkflow],
  );
  const isDirty = section === "company" ? companyDirty : workflowDirty;
  const canSave = isDirty && !pending;

  function selectSection(next: SettingsSection) {
    setSection(next);
    setError(null);
    router.replace(
      `/${form.organizationCode}/company-settings?section=${next}`,
      { scroll: false },
    );
  }

  function updateField(key: FieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateStageConfig(
    stageKey: InquiryStageKey,
    patch: Partial<InquiryWorkflowStageConfig>,
  ) {
    setWorkflow((current) => ({
      ...current,
      [stageKey]: {
        ...current[stageKey],
        ...patch,
      },
    }));
  }

  function onCancel() {
    router.push(companyPath(form.organizationCode));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || pending) return;
    setError(null);
    setPending(true);
    try {
      if (section === "company") {
        const next = await unwrap(saveCompanySettingsAction(form.organizationCode, {
          companyName: form.companyName,
          telephoneNumber: form.telephoneNumber,
          phoneNumber: form.phoneNumber,
          whatsappNumber: form.whatsappNumber,
          email: form.email,
          websiteUrl: form.websiteUrl,
          instagramUrl: form.instagramUrl,
          facebookUrl: form.facebookUrl,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          attendanceSheetNotes: form.attendanceSheetNotes,
        }));
        setForm(next);
        setSaved(next);
        refreshOrganizations(
          organizations.map((org) =>
            org.id === next.organizationId
              ? { ...org, name: next.companyName }
              : org,
          ),
        );
        showToast("Company settings saved");
      } else {
        const next = await unwrap(saveInquiryWorkflowMapAction(
          form.organizationCode,
          workflow,
        ));
        setWorkflow(next);
        setSavedWorkflow(next);
        showToast("Inquiry settings saved");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save settings.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none fixed top-14 right-4 z-30 sm:right-6">
        <div className="pointer-events-auto flex items-center gap-2 border border-zinc-200 bg-white px-2 py-1.5 shadow-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="company-settings-form"
            disabled={!canSave}
            className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white sm:w-56">
          <div className="border-b border-zinc-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-zinc-900">
              Company Settings
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {form.organizationCode}
            </p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {(
              [
                { key: "company", label: "Company" },
                { key: "inquiry-settings", label: "Inquiry Settings" },
              ] as const
            ).map((item) => {
              const active = item.key === section;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectSection(item.key)}
                  className={[
                    "px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-header text-header-fg"
                      : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <form
            id="company-settings-form"
            onSubmit={onSubmit}
            className="w-full max-w-4xl border border-zinc-300 bg-white"
          >
            {section === "company" ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h2 className="font-display text-base font-semibold text-zinc-900">
                    Company profile
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Contact details and public admin for this company.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  {CONTACT_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className={[
                        "flex flex-col gap-1.5",
                        field.key === "companyName" ? "sm:col-span-2" : "",
                      ].join(" ")}
                    >
                      <span className="text-[12px] font-medium text-zinc-700">
                        {field.label}
                      </span>
                      <input
                        type={field.type ?? "text"}
                        value={form[field.key]}
                        onChange={(event) =>
                          updateField(field.key, event.target.value)
                        }
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-header"
                      />
                    </label>
                  ))}
                </div>

                <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <h3 className="font-display text-sm font-semibold text-zinc-900">
                    Who is the Admin of this company
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    The main contact person for this company.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  {ADMIN_FIELDS.map((field) => (
                    <label key={field.key} className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-zinc-700">
                        {field.label}
                      </span>
                      <input
                        type={field.type ?? "text"}
                        value={form[field.key]}
                        onChange={(event) =>
                          updateField(field.key, event.target.value)
                        }
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-header"
                      />
                    </label>
                  ))}
                </div>

                <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <h3 className="font-display text-sm font-semibold text-zinc-900">
                    Printed forms
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Text that appears on forms printed from the system.
                  </p>
                </div>

                <div className="px-4 py-4 sm:px-5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Notes under the attendance sheet (one per line)
                    </span>
                    <textarea
                      rows={3}
                      value={form.attendanceSheetNotes}
                      onChange={(event) =>
                        updateField("attendanceSheetNotes", event.target.value)
                      }
                      placeholder="FOR ANY CLARIFICATION AFTER 6.10PM END OF DUTY HOURS ASK FROM OFFICE"
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-header"
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h2 className="font-display text-base font-semibold text-zinc-900">
                    Inquiry Settings
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Map each locked stage to a department and optional
                    approval. Stage order cannot change.
                  </p>
                </div>

                <div className="overflow-x-auto px-3 py-4 sm:px-5">
                  <table className="w-full min-w-[44rem] border-collapse border border-[#b4b4b4] text-sm">
                    <thead>
                      <tr className="bg-[#e7e6e6] text-left text-[12px] font-semibold uppercase tracking-wide text-zinc-700">
                        <th className="w-10 border border-[#b4b4b4] px-2 py-2 text-center font-semibold text-zinc-500">
                          #
                        </th>
                        <th className="border border-[#b4b4b4] px-3 py-2">
                          Stages
                        </th>
                        <th className="border border-[#b4b4b4] px-3 py-2">
                          Handled by Department
                        </th>
                        <th className="w-36 border border-[#b4b4b4] px-3 py-2 text-center">
                          Approval Required
                        </th>
                        <th className="border border-[#b4b4b4] px-3 py-2">
                          Approval Required by
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {INQUIRY_STAGES.map((stage, index) => {
                        const config = workflow[stage.key];
                        const isLast = index === INQUIRY_STAGES.length - 1;
                        return (
                          <tr
                            key={stage.key}
                            className={
                              index % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                            }
                          >
                            <td className="relative overflow-visible border border-[#b4b4b4] px-2 py-3 text-center align-middle">
                              <span className="relative z-[1] inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-header bg-white text-[11px] font-bold text-header shadow-sm">
                                {index + 1}
                              </span>
                              {!isLast ? (
                                <span
                                  aria-hidden
                                  className="pointer-events-none absolute left-1/2 top-[calc(50%+0.95rem)] z-0 flex h-[calc(100%+0.15rem)] w-0 -translate-x-1/2 flex-col items-center"
                                >
                                  <span className="w-px grow bg-[#94a3b8]" />
                                  <span className="-mt-px border-x-[5px] border-t-[7px] border-x-transparent border-t-[#94a3b8]" />
                                </span>
                              ) : null}
                            </td>
                            <td className="border border-[#b4b4b4] px-3 py-2.5 align-middle font-medium text-zinc-900">
                              {stage.label}
                            </td>
                            <td className="border border-[#b4b4b4] p-0 align-middle">
                              <select
                                value={config.departmentKey}
                                onChange={(event) =>
                                  updateStageConfig(stage.key, {
                                    departmentKey: event.target
                                      .value as InquiryWorkflowDepartmentKey,
                                  })
                                }
                                className="h-full w-full border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:bg-[#fff8e1]"
                              >
                                {INQUIRY_WORKFLOW_DEPARTMENTS.map((dept) => (
                                  <option key={dept.key} value={dept.key}>
                                    {dept.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="border border-[#b4b4b4] px-3 py-2.5 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={config.approvalRequired}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  updateStageConfig(stage.key, {
                                    approvalRequired: checked,
                                    approvalRequiredBy: checked
                                      ? config.approvalRequiredBy ||
                                        "management"
                                      : "",
                                  });
                                }}
                                className="h-4 w-4 cursor-pointer accent-header"
                                aria-label={`Approval required for ${stage.label}`}
                              />
                            </td>
                            <td className="border border-[#b4b4b4] p-0 align-middle">
                              <select
                                value={config.approvalRequiredBy}
                                disabled={!config.approvalRequired}
                                onChange={(event) =>
                                  updateStageConfig(stage.key, {
                                    approvalRequiredBy: event.target
                                      .value as InquiryApprovalRoleKey,
                                  })
                                }
                                className="h-full w-full border-0 bg-transparent px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#f0f0f0] disabled:text-zinc-400 focus:bg-[#fff8e1]"
                              >
                                {!config.approvalRequired ? (
                                  <option value="">—</option>
                                ) : null}
                                {INQUIRY_APPROVAL_ROLES.map((role) => (
                                  <option key={role.key} value={role.key}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {error ? (
              <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}
