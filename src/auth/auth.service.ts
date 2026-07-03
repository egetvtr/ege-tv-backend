import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * E-posta + şifre doğrular, başarılıysa access_token döner.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('E-posta veya şifre hatalı');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('E-posta veya şifre hatalı');

    const token = this.signToken(user.id, user.email, user.role);
    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /**
   * Yeni admin kullanıcısı oluşturur.
   * - Eğer hiç kullanıcı yoksa (ilk kurulum), herkese açık.
   * - Sonraki kayıtlar SUPER_ADMIN token'ı gerektirir (controller tarafında guard ile yönetilir).
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Bu e-posta zaten kayıtlı');

    const hashed = await bcrypt.hash(dto.password, 12);

    // İlk kullanıcıya otomatik SUPER_ADMIN rolü ver
    const userCount = await this.prisma.adminUser.count();
    const role: AdminRole = userCount === 0 ? AdminRole.SUPER_ADMIN : (dto.role ?? AdminRole.EDITOR);

    const user = await this.prisma.adminUser.create({
      data: { email: dto.email, password: hashed, name: dto.name, role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const token = this.signToken(user.id, user.email, user.role);
    return { access_token: token, user };
  }

  /**
   * Token'dan elde edilen userId ile kullanıcı profilini döner.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  /**
   * Kullanıcı şifresini değiştirir.
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mevcut şifre hatalı');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.adminUser.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Şifre başarıyla güncellendi' };
  }

  // ---------- Admin kullanıcı yönetimi (SUPER_ADMIN) ----------

  async listUsers() {
    return this.prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteUser(userId: string) {
    await this.prisma.adminUser.delete({ where: { id: userId } });
    return { message: 'Kullanıcı silindi' };
  }

  // ---------- Yardımcı ----------

  private signToken(userId: string, email: string, role: string): string {
    return this.jwt.sign(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>('JWT_SECRET', 'changeme-secret'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d'),
      },
    );
  }
}
