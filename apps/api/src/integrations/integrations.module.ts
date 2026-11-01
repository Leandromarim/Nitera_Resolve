import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { WhatsappService } from './whatsapp.service';

@Global()
@Module({ providers: [WhatsappService, MailService], exports: [WhatsappService, MailService] })
export class IntegrationsModule {}
