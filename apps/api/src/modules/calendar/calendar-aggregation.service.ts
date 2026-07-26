import { Injectable, Logger } from "@nestjs/common";
import { ElectionStatus, InvoiceStatus, UserRole } from "@prisma/client";
import { AudienceScopeService } from "../../common/audience/audience-scope.service";
import { PERMISSIONS, getPermissionsForRole } from "../../common/permissions/permissions";
import { RequestUser } from "../../common/types/request-context";
import { PrismaService } from "../../core/prisma/prisma.service";
import { ElectionsService } from "../elections/elections.service";
import { EventsService } from "../events/events.service";
import { HomeworkService } from "../homework/homework.service";
import { PaymentsService } from "../payments/payments.service";
import {
  type CalendarItem,
  type CalendarSource,
  DEFAULT_CALENDAR_SOURCES,
  type ListCalendarQuery,
} from "./calendar.schemas";

/**
 * Agregación multi-fuente del calendario (docs/planning/calendario.md, Fase 3).
 *
 * Este es el diferencial del módulo y también **el riesgo de seguridad número uno del plan**
 * (§7.3): un endpoint que junta seis módulos es un punto único donde una consulta mal filtrada
 * expone notas, deudas o datos de otra familia.
 *
 * Dos reglas, y la segunda no es obvia:
 *
 *  1. **Cada fuente llama al servicio de su módulo con el actor real**, en vez de consultar
 *     Prisma por su cuenta. Así el scoping por rol se hereda en vez de reimplementarse.
 *  2. **Cada fuente se cierra además con el permiso que protege su propia ruta.** Delegar no
 *     alcanza: varios servicios del repo confían en que el permiso ya se validó en el
 *     controlador. `PaymentsService#listInvoices` es el caso que lo demuestra — filtra solo por
 *     `tenantId`, porque su ruta exige `PAYMENTS_MANAGE`. Llamarlo desde acá para un acudiente
 *     habría listado las facturas de todas las familias del colegio. La agregación no puede
 *     ver nada que el actor no pudiera haber pedido por sí mismo.
 *
 * Todo lo derivado sale con `editable: false` y un deep link al módulo dueño: el calendario
 * muestra, no edita (§2.D).
 */
@Injectable()
export class CalendarAggregationService {
  private readonly logger = new Logger(CalendarAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceScopeService,
    private readonly events: EventsService,
    private readonly homework: HomeworkService,
    private readonly payments: PaymentsService,
    private readonly elections: ElectionsService,
  ) {}

  async list(actor: RequestUser, query: ListCalendarQuery): Promise<CalendarItem[]> {
    const sources = query.sources ?? DEFAULT_CALENDAR_SOURCES;
    const { from, to } = query;

    // En paralelo porque son fuentes independientes: en secuencia, una vista de mes paga la
    // suma de las seis latencias.
    const groups = await Promise.all(
      sources.map((source) => this.itemsFor(source, actor, from, to)),
    );

    return groups
      .flat()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  private itemsFor(
    source: CalendarSource,
    actor: RequestUser,
    from: Date,
    to: Date,
  ): Promise<CalendarItem[]> {
    switch (source) {
      case "event":
        return this.eventItems(actor, from, to);
      case "homework":
        return this.homeworkItems(actor, from, to);
      case "period":
        return this.periodItems(actor, from, to);
      case "invoice":
        return this.invoiceItems(actor, from, to);
      case "election":
        return this.electionItems(actor, from, to);
      case "schedule":
        return this.scheduleItems(actor, from, to);
    }
  }

  // ─── Fuentes ────────────────────────────────────────────────────────────────

  /** Lo único editable del calendario: los eventos propios del módulo. */
  private async eventItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    if (!this.can(actor, PERMISSIONS.EVENTS_LIST)) return [];

    const events = await this.events.list(actor, { from, to });

    return events.map((event) => ({
      id: `event:${event.id}`,
      source: "event" as const,
      sourceId: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      location: event.location,
      // El único `true` de todo el archivo. Si el actor puede editarlo o no lo decide el
      // módulo de eventos cuando reciba el PATCH; acá solo se marca que este ítem sí vive en
      // el calendario en vez de ser el reflejo de otro módulo.
      editable: true,
      href: `/admin/calendario?event=${event.id}`,
    }));
  }

  /**
   * Entregas y exámenes. `HomeworkService#list` ya scoped por rol —profesor sus tareas, alumno
   * su grupo, acudiente los grupos de sus hijos— así que acá solo se acota al rango.
   *
   * El filtrado por fecha se hace en memoria porque `ListHomeworkQuery` no tiene rango: son
   * decenas de tareas por año, no miles. Si algún día pesa, el arreglo es agregarle `from`/`to`
   * a esa query, no consultar Prisma directo desde acá.
   */
  private async homeworkItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    if (!this.can(actor, PERMISSIONS.HOMEWORK_LIST)) return [];

    const homework = await this.homework.list(actor, {});

    return homework
      .filter((task) => this.inRange(task.dueDate, from, to))
      .map((task) => ({
        id: `homework:${task.id}`,
        source: "homework" as const,
        sourceId: task.id,
        title: `Entrega: ${task.title}`,
        description: task.subject?.name ? `Materia: ${task.subject.name}` : null,
        // Media hora antes del cierre: un instante puntual se pierde en una grilla de día.
        startsAt: new Date(task.dueDate.getTime() - 30 * 60 * 1000),
        endsAt: task.dueDate,
        allDay: false,
        location: null,
        editable: false,
        href: `/admin/tareas?id=${task.id}`,
      }));
  }

  /**
   * Bandas de inicio y cierre de periodo. Es información institucional (nombre y fechas) y la
   * ve cualquier miembro del colegio; no lleva permiso propio porque no existe una ruta que la
   * proteja más que el hecho de estar autenticado en el tenant.
   */
  private async periodItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    const periods = await this.prisma.academicPeriod.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        academicYear: { select: { name: true } },
      },
    });

    // Dos ítems por periodo (apertura y cierre) y no una banda de meses: en una grilla mensual
    // una banda larga se pinta en todos los días y tapa el resto.
    //
    // `startDate`/`endDate` son nullable: el colegio puede tener los periodos creados con sus
    // pesos y todavía sin fechas. Un periodo sin fecha simplemente no aporta ítems.
    return periods.flatMap((period) => {
      const items: CalendarItem[] = [];
      const label = `${period.name} (${period.academicYear.name})`;

      if (period.startDate && this.inRange(period.startDate, from, to)) {
        items.push({
          id: `period:${period.id}:start`,
          source: "period",
          sourceId: period.id,
          title: `Inicia ${label}`,
          startsAt: period.startDate,
          endsAt: period.startDate,
          allDay: true,
          editable: false,
          href: `/admin/academico?periodo=${period.id}`,
        });
      }
      if (period.endDate && this.inRange(period.endDate, from, to)) {
        items.push({
          id: `period:${period.id}:end`,
          source: "period",
          sourceId: period.id,
          title: `Cierra ${label}`,
          startsAt: period.endDate,
          endsAt: period.endDate,
          allDay: true,
          editable: false,
          href: `/admin/academico?periodo=${period.id}`,
        });
      }
      return items;
    });
  }

  /**
   * Vencimientos de cartera. **El caso crítico de toda la fase.**
   *
   * Nunca se agrega por grupo ni por colegio para quien no administra cartera: un acudiente ve
   * únicamente las facturas de sus propios hijos, y la pertenencia la revalida
   * `PaymentsService#getStudentBalance` en cada llamada, no este archivo.
   *
   * Es un N+1 acotado (una consulta por hijo, y son uno o dos) y se elige a propósito sobre una
   * sola consulta por `studentId IN (...)`: cada iteración vuelve a pasar por el chequeo de
   * pertenencia del módulo dueño en vez de confiar en una lista armada acá.
   *
   * Y nada de invitar a pagar: esto es cartera, mostrar el vencimiento. Un botón de pago cruza
   * la frontera de pagos, que no está aprobada (§0 y CLAUDE.md).
   */
  private async invoiceItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    if (this.can(actor, PERMISSIONS.PAYMENTS_MANAGE)) {
      const invoices = await this.payments.listInvoices(actor, {});
      return invoices
        .filter((invoice) => this.isPendingInvoice(invoice.status))
      .filter((invoice) => this.inRange(invoice.dueDate, from, to))
        .map((invoice) => this.invoiceItem(invoice));
    }

    if (!this.can(actor, PERMISSIONS.PAYMENTS_READ_SELF)) return [];

    const studentIds = await this.audience.resolveOwnStudentIds(actor);
    if (studentIds.length === 0) return [];

    const perStudent = await Promise.all(
      studentIds.map((studentId) => this.payments.getStudentBalance(studentId, actor)),
    );

    return perStudent
      .flat()
      .filter((invoice) => this.isPendingInvoice(invoice.status))
      .filter((invoice) => this.inRange(invoice.dueDate, from, to))
      .map((invoice) => this.invoiceItem(invoice));
  }

  /**
   * Solo lo que sigue debiendo. Una factura cancelada no tiene vencimiento que mostrar, y una
   * pagada tampoco: el calendario dice qué se viene, no qué pasó. La consecuencia esperada es
   * que el ítem desaparezca del calendario cuando la familia paga.
   */
  private isPendingInvoice(status: string): boolean {
    return status === InvoiceStatus.PENDING || status === InvoiceStatus.PARTIAL;
  }

  private invoiceItem(invoice: {
    id: string;
    concept?: string | null;
    dueDate: Date;
    status: string;
  }): CalendarItem {
    return {
      id: `invoice:${invoice.id}`,
      source: "invoice",
      sourceId: invoice.id,
      title: `Vence: ${invoice.concept ?? "factura"}`,
      description: null,
      startsAt: invoice.dueDate,
      endsAt: invoice.dueDate,
      allDay: true,
      editable: false,
      href: `/admin/pagos?factura=${invoice.id}`,
    };
  }

  /**
   * Jornadas de votación.
   *
   * Hoy el padrón es todo el colegio (el modelo `Election` no tiene alcance por grupo), así que
   * la distinción real es entre quien administra las elecciones y quien vota. **Los borradores
   * solo los ve quien administra**: una elección en `DRAFT` todavía no se anunció y mostrarla en
   * el calendario de los estudiantes filtra una decisión que no se tomó.
   */
  private async electionItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    const isAdmin =
      this.can(actor, PERMISSIONS.ELECTIONS_MANAGE) || this.can(actor, PERMISSIONS.ELECTIONS_MONITOR);
    const isVoter = this.can(actor, PERMISSIONS.ELECTIONS_VOTE);

    if (!isAdmin && !isVoter) return [];

    const elections = await this.elections.listElections(actor);

    return elections
      .filter((election) => isAdmin || election.status !== ElectionStatus.DRAFT)
      .filter((election) => this.overlaps(election.startDate, election.endDate, from, to))
      .map((election) => ({
        id: `election:${election.id}`,
        source: "election" as const,
        sourceId: election.id,
        title: `Votación: ${election.title}`,
        description: election.description,
        startsAt: election.startDate,
        endsAt: election.endDate,
        allDay: false,
        location: null,
        editable: false,
        href: `/admin/elecciones?id=${election.id}`,
      }));
  }

  /**
   * Clases de la semana. Apagada por default (ver DEFAULT_CALENDAR_SOURCES).
   *
   * `Schedule` es una plantilla semanal sin fecha (`dayOfWeek` + horas como texto), así que acá
   * se expande a ocurrencias concretas dentro del rango. Por eso mismo es la fuente más cara y
   * la que más satura: cinco clases por día por cada día del rango.
   */
  private async scheduleItems(actor: RequestUser, from: Date, to: Date): Promise<CalendarItem[]> {
    if (!this.can(actor, PERMISSIONS.SCHEDULES_LIST)) return [];

    const groupIds = await this.audience.resolveUserGroupIds(actor);
    const isStaff = groupIds.length === 0 && this.can(actor, PERMISSIONS.SCHEDULES_READ);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(isStaff ? {} : { groupId: { in: groupIds } }),
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        subject: { select: { name: true } },
        group: { select: { name: true } },
      },
    });

    if (schedules.length === 0) return [];

    const items: CalendarItem[] = [];
    // Tope duro: sin él, un rango de 400 días con 30 horarios genera ~17.000 ítems y la
    // respuesta se vuelve inmanejable. Se corta explícitamente y no en silencio.
    const MAX_OCCURRENCES = 2000;

    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (cursor.getTime() <= to.getTime() && items.length < MAX_OCCURRENCES) {
      for (const schedule of schedules) {
        if (schedule.dayOfWeek !== cursor.getDay()) continue;
        if (items.length >= MAX_OCCURRENCES) break;

        const start = this.atLocalTime(cursor, schedule.startTime);
        const end = this.atLocalTime(cursor, schedule.endTime);
        if (!this.inRange(start, from, to)) continue;

        items.push({
          id: `schedule:${schedule.id}:${cursor.toISOString().slice(0, 10)}`,
          source: "schedule",
          sourceId: schedule.id,
          title: `${schedule.subject.name} · ${schedule.group.name}`,
          startsAt: start,
          endsAt: end,
          allDay: false,
          location: schedule.room,
          editable: false,
          href: `/admin/horarios?id=${schedule.id}`,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (items.length >= MAX_OCCURRENCES) {
      // Un tope silencioso se lee como "acá está todo". Si se cortó, que quede dicho.
      this.logger.warn(
        `Clases truncadas en ${MAX_OCCURRENCES} ocurrencias para el tenant ${actor.tenantId}: el rango pedido es demasiado ancho para la fuente 'schedule'.`,
      );
    }

    return items;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Los permisos se derivan del rol y **no se leen del token**: `RequestUser.permissions` es
   * opcional y viene del JWT, así que un token viejo emitido antes de un cambio de permisos
   * traería una lista desactualizada. `getPermissionsForRole` es la misma fuente que usa
   * PermissionsGuard.
   */
  private can(actor: RequestUser, permission: string): boolean {
    if (actor.role === UserRole.SUPER_ADMIN) return true;
    return (getPermissionsForRole(actor.role) as string[]).includes(permission);
  }

  private inRange(date: Date, from: Date, to: Date): boolean {
    return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
  }

  private overlaps(start: Date, end: Date, from: Date, to: Date): boolean {
    return start.getTime() <= to.getTime() && end.getTime() >= from.getTime();
  }

  /** "07:30" sobre una fecha, en hora local del servidor. */
  private atLocalTime(day: Date, time: string): Date {
    const [hour, minute] = time.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour || 0, minute || 0);
  }
}
