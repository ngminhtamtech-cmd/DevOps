import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ProfilesRepository } from './profiles.repository';

@Global()
@Module({
  controllers: [AuthController],
  providers: [ProfilesRepository],
  exports: [ProfilesRepository],
})
export class AuthModule {}
