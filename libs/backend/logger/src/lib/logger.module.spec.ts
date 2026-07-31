import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from './logger.module';

describe('LoggerModule', () => {
  it('compiles when forRoot() is called', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ serviceName: 'test-service' })],
    }).compile();

    expect(moduleRef).toBeDefined();
  });

  it('makes ClsService injectable in consuming modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ serviceName: 'test-service' })],
    }).compile();

    const cls = moduleRef.get(ClsService);
    expect(cls).toBeDefined();
    expect(cls).toBeInstanceOf(ClsService);
  });
});
