import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;      // AdminUser.id
  email: string;
  role: string;
}

/**
 * Bearer token'dan JWT'yi parse edip doğrular.
 * Doğrulama başarılıysa `request.user` olarak JwtPayload enjekte edilir.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'changeme-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Bu nesne request.user'a atanır
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
