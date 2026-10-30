import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { z } from 'zod';
import { UsersRepository } from '../../users/users.repository.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }
  async validate(payload: unknown) {
    const result = z.object({ sub: z.uuid() }).safeParse(payload);
    if (!result.success)
      throw new UnauthorizedException('Invalid access token');
    const user = await this.users.findById(result.data.sub);
    if (!user) throw new UnauthorizedException('Invalid access token');
    return user;
  }
}
