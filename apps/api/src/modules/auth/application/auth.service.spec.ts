import { AppError } from '../../../common/errors/app-error';
import { AUTH_CUSTOMER_ROLE } from '../constants/auth-role.constants';
import {
  AUTH_SESSION_TYPE_AUTHENTICATED,
  AUTH_USER_STATUS_ACTIVE,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  type AuthUserStatus,
} from '../constants/auth.constants';
import { AuthAuditRepository } from '../repositories/auth-audit.repository';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import {
  SupabaseAuthRepository,
  type SupabaseAuthSessionResult,
} from '../repositories/supabase-auth.repository';
import { AuthUserRepository } from '../repositories/auth-user.repository';
import type { AuthSessionInternal } from '../types/auth-session.types';
import type { AuthUserInternalProfile } from '../types/auth-user.types';
import { AuthService } from './auth.service';

jest.mock('../../../common/config', () => ({
  currentAuthConfig: {
    token: {
      accessTokenHashPepper: 'test-auth-token-hash-pepper-value-0001',
    },
    session: {
      ttlHours: 24,
    },
  },
}));

const NOW = new Date('2026-06-22T09:00:00.000Z');
const APP_SESSION_EXPIRES_AT = '2026-06-23T09:00:00.000Z';
const BLOCKED_USER_STATUSES: readonly AuthUserStatus[] = [
  AUTH_USER_STATUS_PENDING_EMAIL_VERIFICATION,
  AUTH_USER_STATUS_DEACTIVATED,
  AUTH_USER_STATUS_DELETED,
];

function createUser(
  status: AuthUserStatus = AUTH_USER_STATUS_ACTIVE,
): AuthUserInternalProfile {
  return {
    id: 'app-user-1',
    authUserId: 'provider-user-1',
    email: 'user@example.com',
    phone: null,
    fullName: 'Test User',
    role: AUTH_CUSTOMER_ROLE,
    status,
    isGuest: false,
    avatarPath: null,
    timezone: 'Asia/Kuwait',
    metadata: {},
    guestExpiresAt: null,
    convertedFromGuestAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    deactivatedAt:
      status === AUTH_USER_STATUS_DEACTIVATED ? NOW.toISOString() : null,
    deletedAt: status === AUTH_USER_STATUS_DELETED ? NOW.toISOString() : null,
  };
}

function createSession(
  overrides: Partial<AuthSessionInternal> = {},
): AuthSessionInternal {
  return {
    id: 'session-1',
    userId: 'app-user-1',
    supabaseAuthUserId: 'provider-user-1',
    accessTokenHash: 'old-access-token-hash',
    refreshTokenHash: 'old-refresh-token-hash',
    sessionType: AUTH_SESSION_TYPE_AUTHENTICATED,
    deviceId: 'web-browser',
    deviceName: 'Test Browser',
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-06-22T08:00:00.000Z',
    lastSeenAt: null,
    expiresAt: APP_SESSION_EXPIRES_AT,
    revokedAt: null,
    revokedReason: null,
    convertedAt: null,
    ...overrides,
  };
}

const INELIGIBLE_SESSION_CASES: ReadonlyArray<
  readonly [string, AuthSessionInternal]
> = [
  ['revoked', createSession({ revokedAt: NOW.toISOString() })],
  ['converted', createSession({ convertedAt: NOW.toISOString() })],
  ['expired', createSession({ expiresAt: '2026-06-22T08:59:59.000Z' })],
  ['missing-expiry', createSession({ expiresAt: null })],
  ['malformed-expiry', createSession({ expiresAt: 'not-a-date' })],
];

function createProviderResult(
  userId = 'provider-user-1',
  expiresAt = Math.floor(NOW.getTime() / 1000) - 60,
): SupabaseAuthSessionResult {
  const user = {
    id: userId,
    email: 'user@example.com',
    phone: null,
    emailConfirmedAt: '2026-06-01T00:00:00.000Z',
    phoneConfirmedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    isAnonymous: false,
    appMetadata: {},
    userMetadata: {},
  };

  return {
    user,
    session: {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'bearer',
      expiresIn: 3600,
      expiresAt,
      user,
    },
  };
}

describe('AuthService session lifetime and refresh', () => {
  let service: AuthService;
  let supabaseAuthRepository: jest.Mocked<SupabaseAuthRepository>;
  let authUserRepository: jest.Mocked<AuthUserRepository>;
  let authSessionRepository: jest.Mocked<AuthSessionRepository>;
  let authAuditRepository: jest.Mocked<AuthAuditRepository>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    supabaseAuthRepository = {
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
    } as unknown as jest.Mocked<SupabaseAuthRepository>;
    authUserRepository = {
      getByAuthUserId: jest.fn(),
      getById: jest.fn(),
    } as unknown as jest.Mocked<AuthUserRepository>;
    authSessionRepository = {
      createSession: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      updateTokenHashes: jest.fn(),
    } as unknown as jest.Mocked<AuthSessionRepository>;
    authAuditRepository = {
      createEvent: jest.fn().mockResolvedValue({
        id: 'audit-1',
        actorUserId: 'app-user-1',
        targetUserId: 'app-user-1',
        eventType: 'TOKEN_REFRESHED',
        ipAddress: null,
        userAgent: null,
        metadata: {},
        createdAt: NOW.toISOString(),
      }),
    } as unknown as jest.Mocked<AuthAuditRepository>;

    service = new AuthService(
      supabaseAuthRepository,
      authUserRepository,
      authSessionRepository,
      authAuditRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores the LAFAM session TTL on login instead of provider access-token expiry', async () => {
    const user = createUser();
    const providerResult = createProviderResult(
      user.authUserId,
      Math.floor(NOW.getTime() / 1000) + 3600,
    );

    supabaseAuthRepository.signInWithPassword.mockResolvedValue(providerResult);
    authUserRepository.getByAuthUserId.mockResolvedValue(user);
    authSessionRepository.createSession.mockImplementation((input) =>
      Promise.resolve(createSession({ expiresAt: input.expiresAt ?? null })),
    );

    const result = await service.login({
      email: 'user@example.com',
      password: 'Password123!',
    });

    const createSessionInput =
      authSessionRepository.createSession.mock.calls[0]?.[0];

    expect(createSessionInput?.expiresAt).toBe(APP_SESSION_EXPIRES_AT);
    expect(result.session.expires_at).toBe(APP_SESSION_EXPIRES_AT);
  });

  it('refreshes when provider access-token expiry has passed but app-session expiry is valid', async () => {
    const existingSession = createSession();
    const updatedSession = createSession({
      accessTokenHash: 'new-access-token-hash',
      refreshTokenHash: 'new-refresh-token-hash',
      lastSeenAt: NOW.toISOString(),
      expiresAt: APP_SESSION_EXPIRES_AT,
    });

    authSessionRepository.findByRefreshTokenHash.mockResolvedValue(
      existingSession,
    );
    authUserRepository.getById.mockResolvedValue(createUser());
    supabaseAuthRepository.refreshSession.mockResolvedValue(
      createProviderResult(),
    );
    authSessionRepository.updateTokenHashes.mockResolvedValue(updatedSession);

    const result = await service.refreshToken({
      refresh_token: 'old-refresh-token',
    });

    const updateInput =
      authSessionRepository.updateTokenHashes.mock.calls[0]?.[0];

    expect(supabaseAuthRepository.refreshSession.mock.calls).toHaveLength(1);
    expect(updateInput?.sessionId).toBe(existingSession.id);
    expect(updateInput?.previousRefreshTokenHash).toBe(
      existingSession.refreshTokenHash,
    );
    expect(updateInput?.accessTokenHash).not.toBe(
      existingSession.accessTokenHash,
    );
    expect(updateInput?.refreshTokenHash).not.toBe(
      existingSession.refreshTokenHash,
    );
    expect(updateInput?.lastSeenAt).toBe(NOW.toISOString());
    expect(updateInput?.expiresAt).toBe(APP_SESSION_EXPIRES_AT);
    expect(result.access_token).toBe('new-access-token');
    expect(result.refresh_token).toBe('new-refresh-token');
    expect(result.expires_in).toBe(3600);
    expect(result.session.id).toBe(existingSession.id);
    expect(result.session.expires_at).toBe(APP_SESSION_EXPIRES_AT);
    expect(result.session.last_seen_at).toBe(NOW.toISOString());
  });

  it('rejects an unknown refresh-token hash', async () => {
    authSessionRepository.findByRefreshTokenHash.mockResolvedValue(null);

    await expect(
      service.refreshToken({ refresh_token: 'unknown-refresh-token' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(supabaseAuthRepository.refreshSession.mock.calls).toHaveLength(0);
  });

  it.each(INELIGIBLE_SESSION_CASES)(
    'rejects a %s app session before provider refresh',
    async (_name, session) => {
      authSessionRepository.findByRefreshTokenHash.mockResolvedValue(session);

      await expect(
        service.refreshToken({ refresh_token: 'old-refresh-token' }),
      ).rejects.toBeInstanceOf(AppError);
      expect(supabaseAuthRepository.refreshSession.mock.calls).toHaveLength(0);
    },
  );

  it.each(BLOCKED_USER_STATUSES)(
    'rejects a %s local user before provider refresh',
    async (status) => {
      authSessionRepository.findByRefreshTokenHash.mockResolvedValue(
        createSession(),
      );
      authUserRepository.getById.mockResolvedValue(createUser(status));

      await expect(
        service.refreshToken({ refresh_token: 'old-refresh-token' }),
      ).rejects.toBeInstanceOf(AppError);
      expect(supabaseAuthRepository.refreshSession.mock.calls).toHaveLength(0);
    },
  );

  it('rejects a refreshed provider user mismatch', async () => {
    authSessionRepository.findByRefreshTokenHash.mockResolvedValue(
      createSession(),
    );
    authUserRepository.getById.mockResolvedValue(createUser());
    supabaseAuthRepository.refreshSession.mockResolvedValue(
      createProviderResult('different-provider-user'),
    );

    await expect(
      service.refreshToken({ refresh_token: 'old-refresh-token' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(authSessionRepository.updateTokenHashes.mock.calls).toHaveLength(0);
  });

  it('rejects a stale compare-and-set token rotation', async () => {
    authSessionRepository.findByRefreshTokenHash.mockResolvedValue(
      createSession(),
    );
    authUserRepository.getById.mockResolvedValue(createUser());
    supabaseAuthRepository.refreshSession.mockResolvedValue(
      createProviderResult(),
    );
    authSessionRepository.updateTokenHashes.mockResolvedValue(null);

    await expect(
      service.refreshToken({ refresh_token: 'old-refresh-token' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(authAuditRepository.createEvent.mock.calls).toHaveLength(0);
  });
});
