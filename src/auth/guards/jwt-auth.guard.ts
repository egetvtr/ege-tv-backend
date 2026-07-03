import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Korumalı route'lara koyulur.
 * Authorization: Bearer <jwt> başlığından token doğrular.
 * Geçersiz / eksik token → 401 Unauthorized
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
