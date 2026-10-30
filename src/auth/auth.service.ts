import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository.js';
import type { AuthenticatedUser, RegisterDto } from '../contracts.js';

@Injectable()
export class AuthService {
  // Equalize the bcrypt work for known and unknown email addresses.
  private readonly dummyHash = bcrypt.hashSync(
    'dummy-password-never-used-for-login',
    12,
  );
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await this.users.create({
        email: input.email,
        passwordHash,
        name: input.name ?? null,
      });
      return this.login(user);
    } catch (error) {
      // Inspect PostgreSQL SQLSTATE, including Prisma's wrapped driver errors.
      if (isUniqueViolation(error))
        throw new ConflictException('Email is already registered');
      throw error;
    }
  }
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.users.findByEmail(email);
    const matches = await bcrypt.compare(
      password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !matches)
      throw new UnauthorizedException('Invalid credentials');
    return { id: user.id, email: user.email, name: user.name };
  }
  async login(user: AuthenticatedUser) {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      user,
    };
  }
}
function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false;
  const value = error as Record<string, unknown>;
  return (
    value.sqlState === '23505' ||
    value.code === '23505' ||
    isUniqueViolation(value.cause, depth + 1)
  );
}
