import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

class ChangePasswordDto {
  @ApiProperty({ example: 'eskisifre123' })
  oldPassword: string;

  @ApiProperty({ example: 'yenisifre456' })
  newPassword: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Giriş yap → access_token al
   * Public endpoint — Brute-force koruması: 1 dakikada maks. 5 deneme
   */
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin girişi — JWT token alır' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * İlk admin hesabını oluşturmak için açık.
   * Sonraki kayıtlar için SUPER_ADMIN token'ı gerekir.
   * Rate limit: 1 dakikada maks. 3 kayıt denemesi
   */
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Admin kaydı (ilk kayıt herkese açık, sonraki kayıtlar SUPER_ADMIN gerektirir)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Token'dan profil bilgisi
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giriş yapmış kullanıcının profili' })
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Şifre değiştir
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şifre değiştir' })
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);
  }

  // ---------- SUPER_ADMIN — Kullanıcı Yönetimi ----------

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[SUPER_ADMIN] Tüm admin kullanıcıları listele' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[SUPER_ADMIN] Admin kullanıcısı sil' })
  deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }
}
