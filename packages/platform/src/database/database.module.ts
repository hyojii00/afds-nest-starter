import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly database: DatabaseService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.close();
  }
}
