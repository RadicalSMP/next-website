import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export const INVITATION_RESERVATION_TTL_MINUTES = 10;

export class InvitationReservationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvitationReservationError";
    }
}

async function rollbackQuietly(client: PoolClient) {
    await client.query("ROLLBACK").catch(() => undefined);
}

export async function reserveInvitationCode(
    database: Pool,
    input: { code: string; email: string },
) {
    const client = await database.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `DELETE FROM invitation_code_reservation WHERE "expiresAt" <= NOW()`,
        );
        const result = await client.query(
            `SELECT * FROM invitation_code WHERE code = $1 FOR UPDATE`,
            [input.code],
        );
        const invitation = result.rows[0];
        if (!invitation) throw new InvitationReservationError("邀请码无效");
        if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now()) {
            throw new InvitationReservationError("邀请码已过期");
        }

        const email = input.email.trim().toLowerCase();
        const allowedEmails = Array.isArray(invitation.allowedEmails)
            ? invitation.allowedEmails.map((item: string) => item.toLowerCase())
            : [];
        if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
            throw new InvitationReservationError("该邀请码不允许此邮箱注册");
        }

        const countResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS count
             FROM invitation_code_reservation
             WHERE "codeId" = $1 AND "expiresAt" > NOW()`,
            [invitation.id],
        );
        if (Number(invitation.uses) + Number(countResult.rows[0].count) >= Number(invitation.maxUses)) {
            throw new InvitationReservationError("邀请码已达到最大使用次数");
        }

        const reservationId = randomUUID();
        await client.query(
            `INSERT INTO invitation_code_reservation (id, "codeId", email, "expiresAt")
             VALUES ($1, $2, $3, NOW() + INTERVAL '${INVITATION_RESERVATION_TTL_MINUTES} minutes')`,
            [reservationId, invitation.id, email],
        );
        await client.query("COMMIT");
        return reservationId;
    } catch (error) {
        await rollbackQuietly(client);
        throw error;
    } finally {
        client.release();
    }
}

export async function releaseInvitationReservation(database: Pool, reservationId: string) {
    await database.query(`DELETE FROM invitation_code_reservation WHERE id = $1`, [reservationId]);
}

export async function consumeInvitationReservation(
    database: Pool,
    input: { reservationId: string; userId: string; email: string },
) {
    const client = await database.connect();
    try {
        await client.query("BEGIN");
        const reservationResult = await client.query(
            `SELECT r.id, r."codeId", r.email, r."expiresAt"
             FROM invitation_code_reservation r
             WHERE r.id = $1
             FOR UPDATE`,
            [input.reservationId],
        );
        const reservation = reservationResult.rows[0];
        if (!reservation || new Date(reservation.expiresAt).getTime() <= Date.now()) {
            throw new InvitationReservationError("邀请码预留已失效，请重新注册");
        }
        if (reservation.email !== input.email.trim().toLowerCase()) {
            throw new InvitationReservationError("邀请码预留与注册邮箱不匹配");
        }

        await client.query(`SELECT id FROM invitation_code WHERE id = $1 FOR UPDATE`, [reservation.codeId]);
        await client.query(
            `INSERT INTO invitation_code_usage (id, "codeId", "userId", email)
             VALUES ($1, $2, $3, $4)`,
            [randomUUID(), reservation.codeId, input.userId, input.email],
        );
        const updateResult = await client.query(
            `UPDATE invitation_code
             SET uses = uses + 1
             WHERE id = $1 AND uses < "maxUses"
             RETURNING id`,
            [reservation.codeId],
        );
        if (updateResult.rowCount !== 1) {
            throw new InvitationReservationError("邀请码已达到最大使用次数");
        }
        await client.query(`DELETE FROM invitation_code_reservation WHERE id = $1`, [reservation.id]);
        await client.query("COMMIT");
    } catch (error) {
        await rollbackQuietly(client);
        throw error;
    } finally {
        client.release();
    }
}

export async function deleteUnfinishedAccount(database: Pool, userId: string) {
    await database.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
}
