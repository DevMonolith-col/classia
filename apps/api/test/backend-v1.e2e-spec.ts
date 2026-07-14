import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AttendanceStatus, MembershipStatus, TenantStatus, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/core/prisma/prisma.service";

const DEMO_TENANT_SLUG = "demo";
const DEMO_PASSWORD = "ClassiaDemo2026!";
const TENANT_ADMIN_EMAIL = "tenant-admin.e2e@classia.test";
const TEACHER_EMAIL = "teacher.e2e@classia.test";
const GUARDIAN_EMAIL = "guardian.e2e@classia.test";
const OTHER_TEACHER_EMAIL = "other-teacher.e2e@classia.test";

type ApiResponse<T> = {
  status: number;
  body: T;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  membership: {
    id: string;
    role: string;
  };
};

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  details?: {
    issues?: Array<{
      path: string;
      code: string;
      message: string;
    }>;
  };
  path: string;
  timestamp: string;
  stack?: string;
};

type AuditLogsResponse = {
  items: Array<{
    id: string;
    tenantId: string | null;
    userId: string | null;
    actorRole: string | null;
    action: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    nextCursor?: string;
  };
};

type HomeworkListItem = { id: string };
type MarkListItem = { id: string };
type AttendanceSessionItem = {
  id: string;
  records: Array<{ studentId: string }>;
};

type GuardianScopingFixtures = {
  ownChildHomeworkId: string;
  otherGroupHomeworkId: string;
  ownChildMarkId: string;
  classmateMarkId: string;
  otherChildMarkId: string;
  sharedSessionId: string;
  ownChildStudentId: string;
  classmateStudentId: string;
  otherGroupSessionId: string;
  childTeacherUserId: string;
  otherTeacherUserId: string;
};

type ContactItem = { id: string; role: string };
type ConversationItem = {
  id: string;
  type: string;
  otherParticipants: Array<{ id: string; role: string | null }>;
  unreadCount: number;
  messages: Array<{ id: string; fromId: string; body: string }>;
};
type MessageItem = { id: string; fromId: string; body: string };

describe("Backend v1 e2e", () => {
  let app: INestApplication;
  let baseUrl: string;
  let guardianFixtures: GuardianScopingFixtures;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();
    await ensureDemoE2eUsers(app.get(PrismaService));
    guardianFixtures = await ensureGuardianScopingFixtures(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health and resolves the demo tenant", async () => {
    const health = await api<{ status: string; service: string }>("/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({
      status: "ok",
      service: "classia-api",
    });

    const tenant = await api<{ slug: string; name: string }>("/tenants/current", {
      headers: tenantHeaders(),
    });
    expect(tenant.status).toBe(200);
    expect(tenant.body).toMatchObject({
      slug: DEMO_TENANT_SLUG,
      name: "Colegio Demo Classia",
    });
  });

  it("authenticates the tenant admin and returns the current JWT context", async () => {
    const login = await loginAs(TENANT_ADMIN_EMAIL);
    expect(login.status).toBe(201);
    expect(login.body).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        email: TENANT_ADMIN_EMAIL,
      },
      tenant: {
        slug: DEMO_TENANT_SLUG,
      },
      membership: {
        role: "TENANT_ADMIN",
      },
    });
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));

    const me = await api<{ user: { email: string; role: string; tenantSlug: string } }>(
      "/auth/me",
      {
        headers: authHeaders(login.body.accessToken),
      },
    );
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      email: TENANT_ADMIN_EMAIL,
      role: "TENANT_ADMIN",
      tenantSlug: DEMO_TENANT_SLUG,
    });
  });

  it("rejects invalid credentials, invalid payloads, and missing tokens", async () => {
    const invalidPassword = await api<ErrorResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email: TENANT_ADMIN_EMAIL,
        password: "wrong-password",
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
    expect(invalidPassword.status).toBe(401);
    expect(invalidPassword.body.message).toBe("Invalid credentials.");
    expect(invalidPassword.body.path).toBe("/auth/login");
    expect(invalidPassword.body.timestamp).toEqual(expect.any(String));
    expect(invalidPassword.body.stack).toBeUndefined();

    const invalidPayload = await api<ErrorResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email: TENANT_ADMIN_EMAIL,
        password: "bad",
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
    expect(invalidPayload.status).toBe(400);
    expect(invalidPayload.body.message).toBe("Validation failed.");
    expect(invalidPayload.body.details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "password",
          code: "too_small",
          message: expect.any(String),
        }),
      ]),
    );
    expect(invalidPayload.body.stack).toBeUndefined();

    const missingToken = await api<ErrorResponse>("/auth/me");
    expect(missingToken.status).toBe(401);
    expect(missingToken.body.message).toBe("Access token is required.");
    expect(missingToken.body.path).toBe("/auth/me");
    expect(missingToken.body.stack).toBeUndefined();
  });

  it("refreshes and revokes refresh tokens on logout", async () => {
    const login = await loginAs(TENANT_ADMIN_EMAIL);

    const refresh = await api<LoginResponse>("/auth/refresh", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: login.body.refreshToken,
      }),
    });
    expect(refresh.status).toBe(201);
    expect(refresh.body.accessToken).toEqual(expect.any(String));
    expect(refresh.body.refreshToken).toEqual(expect.any(String));

    const logout = await api<{ status: string }>("/auth/logout", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: refresh.body.refreshToken,
      }),
    });
    expect(logout.status).toBe(201);
    expect(logout.body).toEqual({ status: "ok" });

    const revokedRefresh = await api<ErrorResponse>("/auth/refresh", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        refreshToken: refresh.body.refreshToken,
      }),
    });
    expect(revokedRefresh.status).toBe(401);
    expect(revokedRefresh.body.message).toBe("Invalid refresh token.");
  });

  it("exposes tenant-scoped audit logs only to roles with audit permission", async () => {
    const tenantAdmin = await loginAs(TENANT_ADMIN_EMAIL);
    const audit = await api<AuditLogsResponse>("/audit/logs?limit=5", {
      headers: authHeaders(tenantAdmin.body.accessToken),
    });

    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.items)).toBe(true);
    expect(audit.body.pageInfo).toEqual(
      expect.objectContaining({ hasNextPage: expect.any(Boolean) }),
    );
    expect(audit.body.items.length).toBeGreaterThan(0);
    expect(audit.body.items.every((item) => item.tenantId === tenantAdmin.body.tenant.id)).toBe(
      true,
    );

    const outsideTenant = await api<ErrorResponse>(
      "/audit/logs?tenantId=tenant-outside-demo&limit=1",
      {
        headers: authHeaders(tenantAdmin.body.accessToken),
      },
    );
    expect(outsideTenant.status).toBe(403);
    expect(outsideTenant.body.message).toBe("Audit logs are outside of current tenant.");

    const teacher = await loginAs(TEACHER_EMAIL);
    expect(teacher.status).toBe(201);
    const forbidden = await api<ErrorResponse>("/audit/logs?limit=1", {
      headers: authHeaders(teacher.body.accessToken),
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe("Insufficient permissions.");
  });

  it("scopes a GUARDIAN to homework of their own child's group only", async () => {
    const guardian = await loginAs(GUARDIAN_EMAIL);
    expect(guardian.status).toBe(201);

    const list = await api<HomeworkListItem[]>("/homework", {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(list.status).toBe(200);
    const listedIds = list.body.map((h) => h.id);
    expect(listedIds).toContain(guardianFixtures.ownChildHomeworkId);
    expect(listedIds).not.toContain(guardianFixtures.otherGroupHomeworkId);

    const ownRead = await api<HomeworkListItem>(`/homework/${guardianFixtures.ownChildHomeworkId}`, {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(ownRead.status).toBe(200);

    const otherRead = await api<ErrorResponse>(`/homework/${guardianFixtures.otherGroupHomeworkId}`, {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(otherRead.status).toBe(403);
    expect(otherRead.body.message).toBe("You can only view assignments for your own children's group.");
  });

  it("scopes a GUARDIAN to marks of their own child only, even within the same class", async () => {
    const guardian = await loginAs(GUARDIAN_EMAIL);

    const list = await api<MarkListItem[]>("/marks", {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(list.status).toBe(200);
    const listedIds = list.body.map((m) => m.id);
    expect(listedIds).toContain(guardianFixtures.ownChildMarkId);
    expect(listedIds).not.toContain(guardianFixtures.classmateMarkId);
    expect(listedIds).not.toContain(guardianFixtures.otherChildMarkId);

    const ownRead = await api<MarkListItem>(`/marks/${guardianFixtures.ownChildMarkId}`, {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(ownRead.status).toBe(200);

    const classmateRead = await api<ErrorResponse>(`/marks/${guardianFixtures.classmateMarkId}`, {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(classmateRead.status).toBe(403);
    expect(classmateRead.body.message).toBe("You can only view your own children's marks.");
  });

  it("scopes a GUARDIAN to attendance of their own child's group, hiding classmates' records", async () => {
    const guardian = await loginAs(GUARDIAN_EMAIL);

    const list = await api<AttendanceSessionItem[]>("/attendance/sessions", {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(list.status).toBe(200);
    const listedIds = list.body.map((s) => s.id);
    expect(listedIds).toContain(guardianFixtures.sharedSessionId);
    expect(listedIds).not.toContain(guardianFixtures.otherGroupSessionId);

    const sharedSession = list.body.find((s) => s.id === guardianFixtures.sharedSessionId);
    const sharedRecordStudentIds = sharedSession?.records.map((r) => r.studentId) ?? [];
    expect(sharedRecordStudentIds).toContain(guardianFixtures.ownChildStudentId);
    expect(sharedRecordStudentIds).not.toContain(guardianFixtures.classmateStudentId);

    const sharedRead = await api<AttendanceSessionItem>(
      `/attendance/sessions/${guardianFixtures.sharedSessionId}`,
      { headers: authHeaders(guardian.body.accessToken) },
    );
    expect(sharedRead.status).toBe(200);
    const readRecordStudentIds = sharedRead.body.records.map((r) => r.studentId);
    expect(readRecordStudentIds).toContain(guardianFixtures.ownChildStudentId);
    expect(readRecordStudentIds).not.toContain(guardianFixtures.classmateStudentId);

    const otherRead = await api<ErrorResponse>(
      `/attendance/sessions/${guardianFixtures.otherGroupSessionId}`,
      { headers: authHeaders(guardian.body.accessToken) },
    );
    expect(otherRead.status).toBe(403);
    expect(otherRead.body.message).toBe("You can only view attendance for your own children's group.");
  });

  it("restricts a GUARDIAN's 1:1 chat to their children's teachers and preserves soft-deleted messages", async () => {
    const guardian = await loginAs(GUARDIAN_EMAIL);
    expect(guardian.status).toBe(201);

    // Contactos: el profesor del hijo sí; un profesor ajeno no.
    const contacts = await api<ContactItem[]>("/conversations/contacts", {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(contacts.status).toBe(200);
    const contactIds = contacts.body.map((c) => c.id);
    expect(contactIds).toContain(guardianFixtures.childTeacherUserId);
    expect(contactIds).not.toContain(guardianFixtures.otherTeacherUserId);

    // No puede iniciar conversación con un profesor que no le da clase a sus hijos.
    const forbidden = await api<ErrorResponse>("/conversations", {
      method: "POST",
      headers: jsonHeaders(authHeaders(guardian.body.accessToken)),
      body: JSON.stringify({ participantId: guardianFixtures.otherTeacherUserId }),
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe(
      "No tienes permiso para iniciar una conversación con este usuario.",
    );

    // Sí puede con el profesor de su hijo.
    const created = await api<ConversationItem>("/conversations", {
      method: "POST",
      headers: jsonHeaders(authHeaders(guardian.body.accessToken)),
      body: JSON.stringify({ participantId: guardianFixtures.childTeacherUserId }),
    });
    expect(created.status).toBe(201);
    expect(created.body.type).toBe("DIRECT");
    expect(created.body.otherParticipants.map((p) => p.id)).toContain(
      guardianFixtures.childTeacherUserId,
    );
    const conversationId = created.body.id;

    // Envía un mensaje.
    const sent = await api<MessageItem>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: jsonHeaders(authHeaders(guardian.body.accessToken)),
      body: JSON.stringify({ body: "Buenos días profe, ¿cómo va mi hijo?" }),
    });
    expect(sent.status).toBe(201);
    expect(sent.body.body).toBe("Buenos días profe, ¿cómo va mi hijo?");
    const messageId = sent.body.id;

    // El guardian ve la conversación con su propio mensaje y sin no-leídos.
    const guardianList = await api<ConversationItem[]>("/conversations", {
      headers: authHeaders(guardian.body.accessToken),
    });
    expect(guardianList.status).toBe(200);
    const guardianConv = guardianList.body.find((c) => c.id === conversationId);
    expect(guardianConv?.messages.map((m) => m.id)).toContain(messageId);
    expect(guardianConv?.unreadCount).toBe(0);

    // El profesor ve la conversación con 1 no-leído, luego marca leído.
    const teacher = await loginAs(TEACHER_EMAIL);
    const teacherList = await api<ConversationItem[]>("/conversations", {
      headers: authHeaders(teacher.body.accessToken),
    });
    const teacherConv = teacherList.body.find((c) => c.id === conversationId);
    expect(teacherConv).toBeDefined();
    expect(teacherConv?.unreadCount).toBe(1);
    expect(teacherConv?.messages.some((m) => m.body === "Buenos días profe, ¿cómo va mi hijo?")).toBe(
      true,
    );

    const marked = await api<{ status: string }>(`/conversations/${conversationId}/read`, {
      method: "POST",
      headers: authHeaders(teacher.body.accessToken),
    });
    expect(marked.status).toBe(201);
    const teacherListAfter = await api<ConversationItem[]>("/conversations", {
      headers: authHeaders(teacher.body.accessToken),
    });
    expect(teacherListAfter.body.find((c) => c.id === conversationId)?.unreadCount).toBe(0);

    // Soft-delete del propio mensaje: desaparece de la vista...
    const deleted = await api<{ status: string }>(
      `/conversations/${conversationId}/messages/${messageId}`,
      { method: "DELETE", headers: authHeaders(guardian.body.accessToken) },
    );
    expect(deleted.status).toBe(200);

    const guardianListAfter = await api<ConversationItem[]>("/conversations", {
      headers: authHeaders(guardian.body.accessToken),
    });
    const convAfter = guardianListAfter.body.find((c) => c.id === conversationId);
    expect(convAfter?.messages.map((m) => m.id)).not.toContain(messageId);

    // ...pero la fila permanece en la BD con deletedAt (retención Ley 1620 / Ley 527).
    const prisma = app.get(PrismaService);
    const persisted = await prisma.conversationMessage.findUnique({ where: { id: messageId } });
    expect(persisted).not.toBeNull();
    expect(persisted?.deletedAt).not.toBeNull();
  });

  async function loginAs(email: string): Promise<ApiResponse<LoginResponse>> {
    return api<LoginResponse>("/auth/login", {
      method: "POST",
      headers: jsonHeaders(tenantHeaders()),
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        tenantSlug: DEMO_TENANT_SLUG,
      }),
    });
  }

  async function api<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    const body = text ? (JSON.parse(text) as T) : (undefined as T);

    return {
      status: response.status,
      body,
    };
  }
});

function tenantHeaders(): Record<string, string> {
  return {
    "x-tenant-slug": DEMO_TENANT_SLUG,
  };
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function jsonHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    ...headers,
  };
}

async function ensureDemoE2eUsers(prisma: PrismaService) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {
      name: "Colegio Demo Classia",
      status: TenantStatus.DEMO,
    },
    create: {
      slug: DEMO_TENANT_SLUG,
      name: "Colegio Demo Classia",
      primaryDomain: "app.demo.classia.com.co",
      status: TenantStatus.DEMO,
      brandColor: "#2563eb",
    },
  });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: TENANT_ADMIN_EMAIL,
    firstName: "Tenant Admin",
    lastName: "E2E",
    passwordHash,
    role: UserRole.TENANT_ADMIN,
  });
  await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: TEACHER_EMAIL,
    firstName: "Teacher",
    lastName: "E2E",
    passwordHash,
    role: UserRole.TEACHER,
  });
}

async function ensureUserWithMembership(
  prisma: PrismaService,
  input: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    role: UserRole;
  },
) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: input.tenantId,
        userId: user.id,
      },
    },
    update: {
      role: input.role,
      status: MembershipStatus.ACTIVE,
    },
    create: {
      tenantId: input.tenantId,
      userId: user.id,
      role: input.role,
      status: MembershipStatus.ACTIVE,
    },
  });

  return user;
}

async function findOrCreateGroup(prisma: PrismaService, tenantId: string, name: string) {
  const existing = await prisma.group.findFirst({ where: { tenantId, name } });
  if (existing) return existing;
  return prisma.group.create({ data: { tenantId, name, grade: "5", section: "E2E" } });
}

async function findOrCreateSubject(prisma: PrismaService, tenantId: string, name: string) {
  const existing = await prisma.subject.findFirst({ where: { tenantId, name } });
  if (existing) return existing;
  return prisma.subject.create({ data: { tenantId, name, code: "GUARD-E2E" } });
}

async function ensureGuardianScopingFixtures(prisma: PrismaService): Promise<GuardianScopingFixtures> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: DEMO_TENANT_SLUG } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const teacherUser = await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: TEACHER_EMAIL,
    firstName: "Teacher",
    lastName: "E2E",
    passwordHash,
    role: UserRole.TEACHER,
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: { tenantId: tenant.id },
    create: { userId: teacherUser.id, tenantId: tenant.id },
  });

  const guardianUser = await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: GUARDIAN_EMAIL,
    firstName: "Guardian",
    lastName: "E2E",
    passwordHash,
    role: UserRole.GUARDIAN,
  });
  const guardian = await prisma.guardian.upsert({
    where: { userId: guardianUser.id },
    update: { tenantId: tenant.id },
    create: { userId: guardianUser.id, tenantId: tenant.id },
  });

  const subject = await findOrCreateSubject(prisma, tenant.id, "Matematicas Guardian E2E");
  const sharedGroup = await findOrCreateGroup(prisma, tenant.id, "5A Guardian E2E Shared");
  const otherGroup = await findOrCreateGroup(prisma, tenant.id, "5B Guardian E2E Other");

  const ownChild = await prisma.student.upsert({
    where: { tenantId_documentId: { tenantId: tenant.id, documentId: "GUARDIAN-E2E-OWN-CHILD" } },
    update: { groupId: sharedGroup.id },
    create: {
      tenantId: tenant.id,
      documentId: "GUARDIAN-E2E-OWN-CHILD",
      firstName: "Hijo",
      lastName: "Propio E2E",
      groupId: sharedGroup.id,
    },
  });
  const classmate = await prisma.student.upsert({
    where: { tenantId_documentId: { tenantId: tenant.id, documentId: "GUARDIAN-E2E-CLASSMATE" } },
    update: { groupId: sharedGroup.id },
    create: {
      tenantId: tenant.id,
      documentId: "GUARDIAN-E2E-CLASSMATE",
      firstName: "Companero",
      lastName: "Clase E2E",
      groupId: sharedGroup.id,
    },
  });
  const otherChild = await prisma.student.upsert({
    where: { tenantId_documentId: { tenantId: tenant.id, documentId: "GUARDIAN-E2E-OTHER-CHILD" } },
    update: { groupId: otherGroup.id },
    create: {
      tenantId: tenant.id,
      documentId: "GUARDIAN-E2E-OTHER-CHILD",
      firstName: "Hijo",
      lastName: "Ajeno E2E",
      groupId: otherGroup.id,
    },
  });

  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: ownChild.id, guardianId: guardian.id } },
    update: {},
    create: { studentId: ownChild.id, guardianId: guardian.id, relationship: "parent", isPrimary: true },
  });

  let ownChildHomework = await prisma.homework.findFirst({
    where: { tenantId: tenant.id, groupId: sharedGroup.id, title: "Tarea Guardian E2E Propia" },
  });
  ownChildHomework ??= await prisma.homework.create({
    data: {
      tenantId: tenant.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      groupId: sharedGroup.id,
      title: "Tarea Guardian E2E Propia",
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  let otherGroupHomework = await prisma.homework.findFirst({
    where: { tenantId: tenant.id, groupId: otherGroup.id, title: "Tarea Guardian E2E Ajena" },
  });
  otherGroupHomework ??= await prisma.homework.create({
    data: {
      tenantId: tenant.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      groupId: otherGroup.id,
      title: "Tarea Guardian E2E Ajena",
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  let ownChildMark = await prisma.mark.findFirst({
    where: { tenantId: tenant.id, studentId: ownChild.id, title: "Nota Guardian E2E Propia" },
  });
  ownChildMark ??= await prisma.mark.create({
    data: {
      tenantId: tenant.id,
      studentId: ownChild.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      title: "Nota Guardian E2E Propia",
      value: 4.5,
      maxValue: 5,
    },
  });

  let classmateMark = await prisma.mark.findFirst({
    where: { tenantId: tenant.id, studentId: classmate.id, title: "Nota Guardian E2E Companero" },
  });
  classmateMark ??= await prisma.mark.create({
    data: {
      tenantId: tenant.id,
      studentId: classmate.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      title: "Nota Guardian E2E Companero",
      value: 4.0,
      maxValue: 5,
    },
  });

  let otherChildMark = await prisma.mark.findFirst({
    where: { tenantId: tenant.id, studentId: otherChild.id, title: "Nota Guardian E2E Ajena" },
  });
  otherChildMark ??= await prisma.mark.create({
    data: {
      tenantId: tenant.id,
      studentId: otherChild.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      title: "Nota Guardian E2E Ajena",
      value: 3.5,
      maxValue: 5,
    },
  });

  let sharedSession = await prisma.attendanceSession.findFirst({
    where: { tenantId: tenant.id, groupId: sharedGroup.id },
  });
  sharedSession ??= await prisma.attendanceSession.create({
    data: {
      tenantId: tenant.id,
      groupId: sharedGroup.id,
      teacherId: teacher.id,
      date: new Date("2026-07-01T00:00:00.000Z"),
      isOpen: true,
      records: {
        create: [
          { studentId: ownChild.id, status: AttendanceStatus.PRESENT },
          { studentId: classmate.id, status: AttendanceStatus.ABSENT },
        ],
      },
    },
  });

  let otherGroupSession = await prisma.attendanceSession.findFirst({
    where: { tenantId: tenant.id, groupId: otherGroup.id },
  });
  otherGroupSession ??= await prisma.attendanceSession.create({
    data: {
      tenantId: tenant.id,
      groupId: otherGroup.id,
      teacherId: teacher.id,
      date: new Date("2026-07-01T00:00:00.000Z"),
      isOpen: true,
      records: {
        create: [{ studentId: otherChild.id, status: AttendanceStatus.PRESENT }],
      },
    },
  });

  // El teacher da clase al grupo del hijo del guardian -> es contacto válido para mensajería.
  await findOrCreateSchedule(prisma, {
    tenantId: tenant.id,
    groupId: sharedGroup.id,
    subjectId: subject.id,
    teacherId: teacher.id,
  });

  // Un profesor que NO da clase a ningún hijo del guardian -> NO debe ser contacto válido.
  const otherTeacherUser = await ensureUserWithMembership(prisma, {
    tenantId: tenant.id,
    email: OTHER_TEACHER_EMAIL,
    firstName: "Profesor",
    lastName: "Ajeno E2E",
    passwordHash,
    role: UserRole.TEACHER,
  });
  const otherTeacher = await prisma.teacher.upsert({
    where: { userId: otherTeacherUser.id },
    update: { tenantId: tenant.id },
    create: { userId: otherTeacherUser.id, tenantId: tenant.id },
  });
  await findOrCreateSchedule(prisma, {
    tenantId: tenant.id,
    groupId: otherGroup.id,
    subjectId: subject.id,
    teacherId: otherTeacher.id,
  });

  return {
    ownChildHomeworkId: ownChildHomework.id,
    otherGroupHomeworkId: otherGroupHomework.id,
    ownChildMarkId: ownChildMark.id,
    classmateMarkId: classmateMark.id,
    otherChildMarkId: otherChildMark.id,
    sharedSessionId: sharedSession.id,
    ownChildStudentId: ownChild.id,
    classmateStudentId: classmate.id,
    otherGroupSessionId: otherGroupSession.id,
    childTeacherUserId: teacherUser.id,
    otherTeacherUserId: otherTeacherUser.id,
  };
}

async function findOrCreateSchedule(
  prisma: PrismaService,
  input: { tenantId: string; groupId: string; subjectId: string; teacherId: string },
) {
  const existing = await prisma.schedule.findFirst({
    where: {
      tenantId: input.tenantId,
      groupId: input.groupId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
    },
  });
  if (existing) return existing;
  return prisma.schedule.create({
    data: {
      tenantId: input.tenantId,
      groupId: input.groupId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
    },
  });
}
