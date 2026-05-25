import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto, tenantSlug = "demo") {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new UnauthorizedException("Colegio no encontrado.");

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException("Credenciales inválidas.");

    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Credenciales inválidas.");

    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const access_token = this.jwt.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
