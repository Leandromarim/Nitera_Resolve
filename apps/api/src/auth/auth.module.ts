import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RecuperarSenhaService } from './recuperar-senha.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, RecuperarSenhaService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
