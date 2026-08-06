import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('default-queue')
export class DefaultProcessor extends WorkerHost {
  private readonly logger = new Logger(DefaultProcessor.name);

  async process(job: any, token?: string): Promise<any> {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}`,
    );
    // Placeholder for actual job processing logic
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return { success: true };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: any) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: any, error: Error) {
    this.logger.error(
      `Job ${job.id} failed with error: ${error.message}`,
      error.stack,
    );
  }
}
