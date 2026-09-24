import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser } from './helpers/db-test-helper';
import { processInvitation } from '../pages/api/user/invite';

describe('Tiered Referral Rewards Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('1. should reward Free inviter with +3 unlock quota, and invitee with +3 unlock quota', async () => {
    const freeInviter = await createTestUser(dbClient, {
      email: 'free_inviter@gtb.com',
      memberType: 'free',
      freeQuota: 10,
      downloadQuota: 5
    });

    const invitee = await createTestUser(dbClient, {
      email: 'free_invitee@gtb.com',
      memberType: 'free',
      freeQuota: 10,
      downloadQuota: 5
    });

    await processInvitation(freeInviter.id, invitee.id, dbClient);

    const checkInviter = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [freeInviter.id]);
    const checkInvitee = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [invitee.id]);

    expect(checkInviter.rows[0].free_quota).toBe(13); // 10 + 3
    expect(checkInviter.rows[0].download_quota).toBe(5); // unchanged
    expect(checkInvitee.rows[0].free_quota).toBe(13); // 10 + 3
  });

  it('2. should reward Pro inviter with +10 unlock quota and +2 download quota, and invitee with +3 unlock quota', async () => {
    const proInviter = await createTestUser(dbClient, {
      email: 'pro_inviter@gtb.com',
      memberType: 'pro',
      freeQuota: 50,
      downloadQuota: 10
    });

    const invitee2 = await createTestUser(dbClient, {
      email: 'pro_invitee@gtb.com',
      memberType: 'free',
      freeQuota: 10,
      downloadQuota: 5
    });

    await processInvitation(proInviter.id, invitee2.id, dbClient);

    const checkPro = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [proInviter.id]);
    const checkInvitee2 = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [invitee2.id]);

    expect(checkPro.rows[0].free_quota).toBe(60); // 50 + 10
    expect(checkPro.rows[0].download_quota).toBe(12); // 10 + 2
    expect(checkInvitee2.rows[0].free_quota).toBe(13); // 10 + 3
  });
});
