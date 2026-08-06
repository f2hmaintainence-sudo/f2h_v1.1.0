import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DefaultProcessor } from './processor.base';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'default-queue',
    }),
  ],
  providers: [DefaultProcessor],
  exports: [BullModule],
})
export class QueueModule {}
