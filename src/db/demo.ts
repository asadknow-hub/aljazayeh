// Loaded first: it reads .env.local, which the database modules below need.
import { getAdminDatabaseUrl } from "@/db/admin-env";

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { markAttendanceForUser } from "@/lib/attendance/queries";
import { isWeeklyOff, type AttendanceStatus } from "@/lib/attendance/types";
import { authenticateUser } from "@/lib/auth/authenticate";
import {
  getCompanySettingsForUser,
  saveCompanyLogoForUser,
  saveCompanySettingsForUser,
} from "@/lib/company-settings/queries";
import { datesOfMonth } from "@/lib/datetime/calendar";
import { appDateValue } from "@/lib/datetime/format";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import type { FormType } from "@/lib/forms/definitions";
import {
  createApprovalFormForUser,
  signApprovalFormForUser,
} from "@/lib/forms/queries";
import { createOrganizationForUser } from "@/lib/org/queries";
import type { PositionKey } from "@/lib/signoffs/chains";
import {
  saveSignatureForUser,
  setApprovalPinForUser,
} from "@/lib/signoffs/credentials";
import { setSignatoryForUser } from "@/lib/signoffs/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
} from "@/lib/staff/queries";
import { createVacationRequestForUser } from "@/lib/vacation/queries";
import { loadDemoInquiries } from "@/db/demo-inquiries";

/**
 * Loads a demo company to look around in and to show people: staff with
 * logins, signatories with signatures, this month's attendance, a leave
 * request, one of each signed form at different stages of approval, and
 * inquiries at different steps of the process.
 *
 * Everything goes through the same code the screens use. It does nothing if
 * the demo company is already there, and refuses to run in production.
 */
const ORG = "aje";
const PASSWORD = "demo-pass-123";
const PIN = "4821";

const WORKERS = [
  "Robel",
  "Hasan",
  "Salim",
  "Rahim",
  "Jashim",
  "Mahafujur",
  "Mohon",
  "Gustave",
  "Emmanuel",
  "Nurul Islam",
  "Mostafa",
  "Shamsul Alam",
  "Arman",
  "Reyaz",
  "Khairul Islam",
  "Jubair",
  "Zahidul Islam",
  "Anik",
];

const image = (name: string) =>
  `data:image/png;base64,${fs
    .readFileSync(path.join(process.cwd(), "src", "db", "demo", name))
    .toString("base64")}`;

type Person = { userId: string; staffId: string };

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo company is not for a production database.");
  }

  const admin = postgres(getAdminDatabaseUrl(), { max: 1 });
  const [owner] = await admin<{ id: string }[]>`
    select id from users where is_platform_admin limit 1
  `;
  const [existing] = await admin`
    select 1 from organizations where code = ${ORG}
  `;
  if (!owner) throw new Error("Run `npm run db:setup` first.");

  if (existing) {
    console.log("Demo company is already loaded.");
  } else {
    await loadCompany(owner.id);
  }
  // Added after the first version of the demo, so loaded on its own.
  await loadDemoInquiries(admin, owner.id, ORG);
  await admin.end();
}

async function loadCompany(ownerId: string) {
  const owner = { id: ownerId };
  console.log("Loading the demo company...");
  await createOrganizationForUser(owner.id, {
    name: "Al Jazeyah Engineering LLC",
    code: ORG,
  });
  const settings = await getCompanySettingsForUser(owner.id, ORG);
  await saveCompanySettingsForUser(owner.id, ORG, {
    ...settings!,
    nameArabic: "الجازية للهندسة ذ.م.م",
    attendanceSheetNotes:
      "FOR ANY CLARIFICATION AFTER 6.10PM END OF DUTY HOURS ASK FROM OFFICE",
  });
  await saveCompanyLogoForUser(owner.id, ORG, image("logo.png"));

  const staffIds: Record<string, string> = {};
  const addStaff = async (
    fullName: string,
    jobTitle: string,
    departmentKeys: StaffRoleKey[],
    joinedOn: string,
  ) => {
    const staff = await createStaffForUser(owner.id, ORG, {
      fullName,
      email: "",
      phone: "050 555 0101",
      homeCountryContact: "",
      passportNumber: "",
      jobTitle,
      employeeCode: "",
      joinedOn,
      status: "active",
      notes: "",
      departmentKeys,
    });
    staffIds[fullName] = staff.id;
    return staff.id;
  };
  const addPerson = async (
    username: string,
    fullName: string,
    jobTitle: string,
    departmentKeys: StaffRoleKey[],
  ): Promise<Person> => {
    const staffId = await addStaff(
      fullName,
      jobTitle,
      departmentKeys,
      "2022-01-10",
    );
    await createStaffLoginForUser(owner.id, ORG, staffId, {
      username,
      password: PASSWORD,
    });
    const login = await authenticateUser(username, PASSWORD);
    await setApprovalPinForUser(login!.userId, {
      password: PASSWORD,
      pin: PIN,
    });
    await saveSignatureForUser(
      login!.userId,
      image(`signature-${username}.png`),
    );
    return { userId: login!.userId, staffId };
  };

  const rameez = await addPerson("rameez", "Rameez", "Admin Officer", [
    "admin",
    "reception",
  ]);
  const hakeem = await addPerson("hakeem", "Hakeem", "Foreman", [
    "engineering",
  ]);
  const tabassum = await addPerson("tabassum", "Tabassum Banu", "Accountant", [
    "accounts",
  ]);
  const abu = await addPerson("abu", "Abu Taleb", "CEO & Managing Partner", [
    "management",
  ]);
  const didar = await addPerson("didar", "Didar Alam", "Managing Director", [
    "management",
  ]);
  for (const name of WORKERS) {
    await addStaff(
      name,
      "Welder",
      ["workers"],
      name === "Mahafujur" ? "2024-12-05" : "2023-03-01",
    );
  }

  const signatories: [PositionKey, Person][] = [
    ["admin", rameez],
    ["foreman", hakeem],
    ["purchaser", rameez],
    ["accountant", tabassum],
    ["managing_partner", abu],
    ["managing_director", didar],
  ];
  for (const [position, person] of signatories) {
    await setSignatoryForUser(owner.id, ORG, position, person.staffId);
  }

  // Attendance for this month up to yesterday, with a few absences.
  const today = appDateValue();
  for (const date of datesOfMonth(today.slice(0, 7)).filter(
    (day) => day < today,
  )) {
    await markAttendanceForUser(
      rameez.userId,
      ORG,
      date,
      Object.values(staffIds).map((staffId, index) => {
        const absent = (index * 7 + Number(date.slice(8))) % 23 === 0;
        const status: AttendanceStatus = isWeeklyOff(date)
          ? "off"
          : absent
            ? "absent"
            : "present";
        return { staffId, status };
      }),
    );
  }

  const everyone = [rameez, hakeem, tabassum, abu, didar];
  /** Raise a form; `approve` signs every box, otherwise it waits at the first. */
  const raise = async (
    by: Person,
    type: FormType,
    staffId: string,
    fields: Record<string, string>,
    lines: Record<string, string>[],
    approve: boolean,
  ) => {
    const form = await createApprovalFormForUser(by.userId, ORG, type, {
      staffId,
      fields,
      lines,
    });
    let status = "pending";
    while (approve && status === "pending") {
      for (const person of everyone) {
        // Only the person whose turn it is can sign; the others are refused.
        status = await signApprovalFormForUser(person.userId, ORG, form.id, {
          pin: PIN,
          decision: "approved",
          remarks: "",
        }).catch(() => status);
      }
    }
  };

  await raise(
    rameez,
    "medical_claim",
    staffIds["Zahidul Islam"]!,
    { date: "2026-11-05", hospital: "Prestine Pharmacy LLC", total: "26.5" },
    [],
    true,
  );
  await raise(
    rameez,
    "fine_notice",
    staffIds["Khairul Islam"]!,
    {
      reason:
        "come to office without informing your Forman and you have been rudely misbehaved with Receptionist and Accountant",
      amount: "50",
    },
    [],
    false,
  );
  await raise(
    tabassum,
    "petty_cash",
    "",
    {
      projectName: "GENERAL PETTY CASH",
      description: "Al Jazeyah Engineering",
      requestDate: "2026-11-01",
    },
    [
      {
        paidBy: "Hakeem",
        foodFor: "Freezone staff",
        description: "Food",
        invoiceQty: "1",
        invoiceAmount: "7",
      },
      {
        vehicleNo: "Petrol can for machining",
        paidBy: "Razel Driver",
        description: "Petrol expenses",
        invoiceQty: "1",
        invoiceAmount: "200",
      },
    ],
    false,
  );
  await raise(
    hakeem,
    "material_request",
    "",
    {
      projectName: "AC GAS",
      section: "Al Jazeyah Workshop",
      description: "AC gas refilling",
      requestDate: "2026-11-10",
    },
    [{ materialDescription: "AC gas ( Refron )", qty: "1" }],
    false,
  );
  await raise(
    rameez,
    "verbal_work_approval",
    "",
    {
      projectName: "GI GALV PIPE",
      requestedBy: "Mr. Nazmul",
      description: "GI galv pipe",
      customerName: "Barton Engineering",
      jobCardNumber: "JBN/25/01110",
      requestDate: "2026-10-29",
      jobNo: "01110",
      deliveryNoteNumber: "52827",
      deliveryDate: "2026-10-29",
    },
    [
      {
        approvedBy: "Arbab",
        materialDescription: 'GI galv pipe 1" 300 mm length SCH STD',
        qty: "28",
        jobPrice: "25",
        sampleNo: "Drawing supplied by the client",
      },
    ],
    true,
  );

  await createVacationRequestForUser(rameez.userId, ORG, {
    staffId: staffIds["Mahafujur"]!,
    startDate: "2027-03-05",
    endDate: "2027-05-07",
    leaveType: "annual",
    reason: "Family visit",
    jobHandledBy: "Reyaz",
    leaveAvailableDays: "",
    officeComments: "",
  });

  console.log(
    [
      "Demo company loaded: Al Jazeyah Engineering LLC",
      `  Logins: rameez, hakeem, tabassum, abu, didar  (password ${PASSWORD}, approval PIN ${PIN})`,
      "  The owner login from db:seed sees everything.",
    ].join("\n"),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
