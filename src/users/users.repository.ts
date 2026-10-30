import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../prisma/database.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}
  findByEmail(email: string) {
    return this.database.client.orm.public.User.where((user) =>
      user.email.eq(email),
    ).first();
  }
  findById(id: string) {
    return this.database.client.orm.public.User.select('id', 'email', 'name')
      .where((user) => user.id.eq(id))
      .first();
  }
  create(input: { email: string; passwordHash: string; name: string | null }) {
    return this.database.client.orm.public.User.select(
      'id',
      'email',
      'name',
    ).create(input);
  }
}
