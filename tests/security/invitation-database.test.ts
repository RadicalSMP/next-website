import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import {
    consumeInvitationReservation,
    releaseInvitationReservation,
    reserveInvitationCode,
} from "@/lib/invitation-reservations";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("隔离数据库安全验证", () => {
    if (!testDatabaseUrl) {
        test.skip("未配置 TEST_DATABASE_URL，未连接任何现有数据库", () => undefined);
        return;
    }

    const schema = `security_test_${crypto.randomUUID().replaceAll("-", "")}`;
    let adminPool: Pool;
    let pool: Pool;

    beforeAll(async () => {
        adminPool = new Pool({ connectionString: testDatabaseUrl });
        await adminPool.query(`CREATE SCHEMA "${schema}"`);
        pool = new Pool({
            connectionString: testDatabaseUrl,
            options: `-c search_path=${schema}`,
        });
        await pool.query(`
            CREATE TABLE "user" (id TEXT PRIMARY KEY);
            CREATE TABLE invitation_code (
                id TEXT PRIMARY KEY,
                code VARCHAR(32) UNIQUE NOT NULL,
                "maxUses" INTEGER NOT NULL DEFAULT 1,
                uses INTEGER NOT NULL DEFAULT 0,
                "allowedEmails" TEXT[],
                "expiresAt" TIMESTAMPTZ
            );
            CREATE TABLE invitation_code_usage (
                id TEXT PRIMARY KEY,
                "codeId" TEXT NOT NULL REFERENCES invitation_code(id) ON DELETE CASCADE,
                "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                email TEXT NOT NULL
            );
            CREATE TABLE invitation_code_reservation (
                id TEXT PRIMARY KEY,
                "codeId" TEXT NOT NULL REFERENCES invitation_code(id) ON DELETE CASCADE,
                email TEXT NOT NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "expiresAt" TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE "rateLimit" (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL UNIQUE,
                count INTEGER NOT NULL,
                "lastRequest" BIGINT NOT NULL
            );
        `);
    });

    afterAll(async () => {
        await pool?.end();
        await adminPool?.query(`DROP SCHEMA "${schema}" CASCADE`);
        await adminPool?.end();
    });

    test("并发预留不会超出邀请码容量", async () => {
        await pool.query(`INSERT INTO invitation_code (id, code, "maxUses") VALUES ('parallel', 'PARALLEL', 1)`);
        const results = await Promise.allSettled([
            reserveInvitationCode(pool, { code: "PARALLEL", email: "one@example.com" }),
            reserveInvitationCode(pool, { code: "PARALLEL", email: "two@example.com" }),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    });

    test("失败释放后名额可再次预留", async () => {
        await pool.query(`INSERT INTO invitation_code (id, code, "maxUses") VALUES ('release', 'RELEASE', 1)`);
        const reservationId = await reserveInvitationCode(pool, { code: "RELEASE", email: "first@example.com" });
        await releaseInvitationReservation(pool, reservationId);

        await expect(reserveInvitationCode(pool, { code: "RELEASE", email: "second@example.com" })).resolves.toBeString();
    });

    test("预留只能消费一次且计数与使用记录一致", async () => {
        await pool.query(`INSERT INTO "user" (id) VALUES ('test-user')`);
        await pool.query(`INSERT INTO invitation_code (id, code, "maxUses") VALUES ('consume', 'CONSUME', 1)`);
        const reservationId = await reserveInvitationCode(pool, { code: "CONSUME", email: "user@example.com" });

        await consumeInvitationReservation(pool, {
            reservationId,
            userId: "test-user",
            email: "user@example.com",
        });
        await expect(consumeInvitationReservation(pool, {
            reservationId,
            userId: "test-user",
            email: "user@example.com",
        })).rejects.toThrow();

        const result = await pool.query(`
            SELECT i.uses,
                   (SELECT COUNT(*)::INTEGER FROM invitation_code_usage WHERE "codeId" = i.id) AS usage_count
            FROM invitation_code i WHERE i.id = 'consume'
        `);
        expect(result.rows[0]).toMatchObject({ uses: 1, usage_count: 1 });
    });

    test("better-auth 在数据库中累计并执行限流", async () => {
        const auth = betterAuth({
            database: pool,
            baseURL: "http://localhost:3000",
            secret: "test-secret-with-at-least-thirty-two-characters",
            rateLimit: {
                enabled: true,
                storage: "database",
                window: 60,
                max: 2,
            },
        });
        const request = () => auth.handler(new Request("http://localhost:3000/api/auth/ok", {
            headers: { "x-forwarded-for": "198.51.100.10" },
        }));

        expect((await request()).status).toBe(200);
        expect((await request()).status).toBe(200);
        expect((await request()).status).toBe(429);
        const stored = await pool.query(`SELECT count FROM "rateLimit"`);
        expect(stored.rows[0].count).toBe(2);
    });
});
