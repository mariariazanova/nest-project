import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { Request, Response } from 'express';

describe('ProxyController', () => {
  let controller: ProxyController;
  let proxyService: ProxyService;

  const mockRequest = {
    url: '/auth/login',
    method: 'POST',
    headers: {},
    body: { username: 'test', password: 'test123' },
    query: {},
  } as Request;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const mockThrottlerGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          provide: ProxyService,
          useValue: {
            forward: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(mockThrottlerGuard)
      .compile();

    controller = module.get(ProxyController);
    proxyService = module.get(ProxyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('proxyAuth', () => {
    it('should forward auth requests to auth-service', async () => {
      await controller.proxyAuth(mockRequest, mockResponse);

      expect(proxyService.forward).toHaveBeenCalledWith(mockRequest, mockResponse, 'auth-service');
    });

    it('should handle different auth paths', async () => {
      const loginReq = { ...mockRequest, url: '/auth/login' } as Request;
      const signupReq = { ...mockRequest, url: '/auth/signup' } as Request;
      const profileReq = { ...mockRequest, url: '/auth/profile' } as Request;

      await controller.proxyAuth(loginReq, mockResponse);
      await controller.proxyAuth(signupReq, mockResponse);
      await controller.proxyAuth(profileReq, mockResponse);

      expect(proxyService.forward).toHaveBeenCalledTimes(3);
    });
  });

  describe('proxySuggestion', () => {
    it('should forward suggestion requests to suggestion-service', async () => {
      const suggestionReq = { ...mockRequest, url: '/suggestion/books' } as Request;

      await controller.proxySuggestion(suggestionReq, mockResponse);

      expect(proxyService.forward).toHaveBeenCalledWith(
        suggestionReq,
        mockResponse,
        'suggestion-service',
      );
    });

    it('should handle various suggestion endpoints', async () => {
      const endpoints = [
        '/suggestion/books',
        '/suggestion/films',
        '/suggestion/series',
        '/suggestion/random',
      ];

      for (const endpoint of endpoints) {
        const req = { ...mockRequest, url: endpoint } as Request;
        await controller.proxySuggestion(req, mockResponse);
      }

      expect(proxyService.forward).toHaveBeenCalledTimes(endpoints.length);
    });
  });

  describe('proxyHistory', () => {
    it('should forward history requests to history-service', async () => {
      const historyReq = { ...mockRequest, url: '/history/recent' } as Request;

      await controller.proxyHistory(historyReq, mockResponse);

      expect(proxyService.forward).toHaveBeenCalledWith(
        historyReq,
        mockResponse,
        'history-service',
      );
    });

    it('should handle different HTTP methods', async () => {
      const getReq = { ...mockRequest, method: 'GET', url: '/history' } as Request;
      const postReq = { ...mockRequest, method: 'POST', url: '/history' } as Request;
      const deleteReq = { ...mockRequest, method: 'DELETE', url: '/history/123' } as Request;

      await controller.proxyHistory(getReq, mockResponse);
      await controller.proxyHistory(postReq, mockResponse);
      await controller.proxyHistory(deleteReq, mockResponse);

      expect(proxyService.forward).toHaveBeenCalledTimes(3);
    });
  });
});
