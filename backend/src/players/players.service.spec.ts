import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from './players.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlayersService', () => {
  let service: PlayersService;
  const prisma = {
    $queryRaw: vi.fn(),
    jogador: { findMany: vi.fn(), count: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll com busca por nome', () => {
    it('filtra pelos ids achados sem considerar acento nem caixa', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 7 }, { id: 9 }]);
      prisma.jogador.findMany.mockResolvedValue([]);
      prisma.jogador.count.mockResolvedValue(0);

      await service.findAll(1, 10, { search: 'JOA' });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [sql] = prisma.$queryRaw.mock.calls[0];
      // O termo vai como parâmetro, já sem acento e em minúsculas.
      expect(sql.values).toContain('%joa%');
      expect(prisma.jogador.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [7, 9] } }),
        }),
      );
    });

    it('escapa os curingas do LIKE digitados pelo usuário', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.jogador.findMany.mockResolvedValue([]);
      prisma.jogador.count.mockResolvedValue(0);

      await service.findAll(1, 10, { search: '50%_' });

      const [sql] = prisma.$queryRaw.mock.calls[0];
      expect(sql.values).toContain('%50!%!_%');
    });

    it('não consulta ids quando não há busca', async () => {
      prisma.jogador.findMany.mockResolvedValue([]);
      prisma.jogador.count.mockResolvedValue(0);

      await service.findAll(1, 10, {});

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
