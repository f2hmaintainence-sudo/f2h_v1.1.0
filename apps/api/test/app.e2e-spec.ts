import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { assertConnectedToTestDatabase } from './assert-test-database';

const TEST_DB = process.env.TEST_DB_DATABASE;
const describeIfTestDb = TEST_DB ? describe : describe.skip;

describeIfTestDb('API root', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await assertConnectedToTestDatabase(app, TEST_DB as string);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers with liveness only', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'f2h-api' });
  });

  /**
   * The root route used to run a Redis benchmark whose payload embedded
   * `SELECT user_id, email, password FROM users` — every account's bcrypt hash,
   * unauthenticated. This asserts the response can never carry credentials again.
   */
  it('never returns user credentials', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/').expect(200);
    const body = JSON.stringify(res.body);

    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/\$2[aby]\$/); // a bcrypt hash prefix
    expect(body).not.toMatch(/@/); // no email addresses
  });
});
