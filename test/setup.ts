import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

export let app: INestApplication;
export let httpServer: any;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0); // Add this so app actually listens on a port, allowing HttpService to reach it
  const address = app.getHttpServer().address();
  process.env.HCM_BASE_URL = `http://127.0.0.1:${address.port}`;
  httpServer = app.getHttpServer();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
  const dbPaths = [
    path.join(process.cwd(), 'timeoff-test.db'),
    path.join(process.cwd(), 'timeoff.db'),
  ];
  for (const dbPath of dbPaths) {
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {
        // ignore
      }
    }
  }
});
