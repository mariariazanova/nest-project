import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { UserActivityProducerService } from './user-activity-producer.service';
import { UserActivityType } from './user-activity.events';

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
  })),
}));

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      SERVICE_NAME: 'test-service',
      KAFKA_BROKERS: 'kafka:9092',
    };
    return config[key] ?? defaultValue;
  }),
};

describe('UserActivityProducerService', () => {
  let service: UserActivityProducerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProducer.connect.mockResolvedValue(undefined);
    mockProducer.disconnect.mockResolvedValue(undefined);
    mockProducer.send.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserActivityProducerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(UserActivityProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect the producer', async () => {
      await service.onModuleInit();

      expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection failure without throwing', async () => {
      mockProducer.connect.mockRejectedValueOnce(
        new Error('Kafka unavailable'),
      );
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect when connected', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should not disconnect when not connected', async () => {
      await service.onModuleDestroy();

      expect(mockProducer.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should send to user.activity topic', async () => {
      await service.emit(UserActivityType.USER_LOGGED_IN, 'user-1', {});

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'user.activity' }),
      );
    });

    it('should use userId as message key', async () => {
      await service.emit(UserActivityType.USER_LOGGED_IN, 'user-1', {});

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ key: 'user-1' }),
          ]),
        }),
      );
    });

    it('should include eventType, userId and payload in message value', async () => {
      await service.emit(UserActivityType.FILE_UPLOADED, 'user-2', {
        fileId: 'f1',
        size: 1024,
      });
      const { value } = mockProducer.send.mock.calls[0][0].messages[0];
      const parsed = JSON.parse(value);

      expect(parsed).toMatchObject({
        eventType: UserActivityType.FILE_UPLOADED,
        userId: 'user-2',
        fileId: 'f1',
        size: 1024,
      });
      expect(parsed.eventId).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });

    it('should include username when provided', async () => {
      await service.emit(
        UserActivityType.USER_LOGGED_IN,
        'user-1',
        {},
        'alice',
      );
      const { value } = mockProducer.send.mock.calls[0][0].messages[0];

      expect(JSON.parse(value).username).toBe('alice');
    });

    it('should set binary headers', async () => {
      await service.emit(UserActivityType.USER_LOGGED_IN, 'user-1', {});
      const { headers } = mockProducer.send.mock.calls[0][0].messages[0];

      expect(headers.eventType).toBeInstanceOf(Buffer);
      expect(headers.eventId).toBeInstanceOf(Buffer);
      expect(headers.timestamp).toBeInstanceOf(Buffer);
    });

    it('should be a no-op when not connected', async () => {
      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [
          UserActivityProducerService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((_k: string, d?: string) => d) },
          },
        ],
      }).compile();
      const freshService = freshModule.get(UserActivityProducerService);

      await freshService.emit(UserActivityType.USER_LOGGED_IN, 'u1', {});

      expect(mockProducer.send).not.toHaveBeenCalled();
    });

    it('should handle send failure without throwing', async () => {
      mockProducer.send.mockRejectedValueOnce(new Error('Send failed'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await expect(
        service.emit(UserActivityType.USER_LOGGED_IN, 'user-1', {}),
      ).resolves.not.toThrow();

      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });
});
