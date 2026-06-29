import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<UserEntity>;

  // Mock repository
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(getRepositoryToken(UserEntity));

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const userData: Partial<UserEntity> = {
        username: 'testuser',
        password: 'hashedpassword123',
      };

      const createdUser: UserEntity = {
        id: 'uuid-123',
        username: 'testuser',
        password: 'hashedpassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedUser: UserEntity = {
        ...createdUser,
      };

      mockRepository.create.mockReturnValue(createdUser);
      mockRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(userData);

      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(createdUser);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(savedUser);
      expect(result.id).toBe('uuid-123');
      expect(result.username).toBe('testuser');
    });

    it('should create user with only username and password', async () => {
      const userData: Partial<UserEntity> = {
        username: 'john',
        password: 'hashed',
      };

      const savedUser: UserEntity = {
        id: 'uuid-456',
        username: 'john',
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(savedUser);
      mockRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(userData);

      expect(result).toEqual(savedUser);
      expect(result.username).toBe('john');
    });

    it('should throw error if save fails', async () => {
      const userData: Partial<UserEntity> = {
        username: 'testuser',
        password: 'hashedpassword',
      };

      const error = new Error('Database connection failed');

      mockRepository.create.mockReturnValue(userData);
      mockRepository.save.mockRejectedValue(error);

      await expect(service.create(userData)).rejects.toThrow('Database connection failed');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const username = 'testuser';
      const foundUser: UserEntity = {
        id: 'uuid-123',
        username: 'testuser',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(foundUser);

      const result = await service.findByUsername(username);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { username },
      });
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual(foundUser);
      expect(result?.username).toBe('testuser');
    });

    it('should return null if user not found', async () => {
      const username = 'nonexistent';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUsername(username);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { username },
      });
      expect(result).toBeNull();
    });

    it('should handle empty username', async () => {
      const username = '';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUsername(username);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { username: '' },
      });
      expect(result).toBeNull();
    });

    it('should throw error if database fails', async () => {
      const username = 'testuser';
      const error = new Error('Database query failed');

      mockRepository.findOne.mockRejectedValue(error);

      await expect(service.findByUsername(username)).rejects.toThrow('Database query failed');
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const userId = 'uuid-123';
      const foundUser: UserEntity = {
        id: 'uuid-123',
        username: 'testuser',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(foundUser);

      const result = await service.findById(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual(foundUser);
      expect(result?.id).toBe('uuid-123');
    });

    it('should return null if user not found', async () => {
      const userId = 'nonexistent-uuid';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toBeNull();
    });

    it('should handle invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(invalidId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: invalidId },
      });
      expect(result).toBeNull();
    });

    it('should throw error if database fails', async () => {
      const userId = 'uuid-123';
      const error = new Error('Database connection lost');

      mockRepository.findOne.mockRejectedValue(error);

      await expect(service.findById(userId)).rejects.toThrow('Database connection lost');
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('repository integration', () => {
    it('should use the injected repository', () => {
      expect(repository).toBeDefined();
      expect(repository).toBe(mockRepository);
    });

    it('should have all required repository methods', () => {
      expect(mockRepository.create).toBeDefined();
      expect(mockRepository.save).toBeDefined();
      expect(mockRepository.findOne).toBeDefined();
    });
  });
});
