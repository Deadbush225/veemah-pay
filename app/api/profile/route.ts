import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";

type Action = "update_profile" | "change_pin" | "change_password" | "verify_email_change";

function isValidEmail(email: string) {
  const v = email.trim();
  if (!v) return false;
  if (v.length > 254) return false;
  const at = v.indexOf("@");
  if (at <= 0 || at !== v.lastIndexOf("@") || at === v.length - 1) return false;
  return true;
}

function getClientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || xf.trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-client-ip") ||
    ""
  );
}

function getApproxLocation(req: NextRequest) {
  const city = req.headers.get("x-vercel-ip-city") || "";
  const region = req.headers.get("x-vercel-ip-country-region") || "";
  const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "";
  const parts = [city, region, country].map((p) => p.trim()).filter(Boolean);
  return parts.join(", ");
}

function formatDateForEmail(d: Date) {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export async function PATCH(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "") as Action;

  if (action !== "update_profile" && action !== "change_pin" && action !== "change_password" && action !== "verify_email_change") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const colsRes = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts'`
  );
  const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
  const hasEmail = cols.includes("email");
  const hasPassword = cols.includes("password");
  const hasFailedAttempts = cols.includes("failed_attempts");

  const selectCols = [
    "account_number",
    "name",
    "pin",
    hasEmail ? "email" : null,
    hasPassword ? "password" : null,
  ].filter(Boolean).join(", ");

  const accRes = await pool.query(`SELECT ${selectCols} FROM public.accounts WHERE account_number = $1`, [session]);
  if (accRes.rowCount === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const acc = accRes.rows[0] as {
    account_number: string;
    name: string;
    pin: string;
    email?: string | null;
    password?: string | null;
  };

  const verifySensitive = async () => {
    const currentPin = String(body?.currentPin ?? "");
    if (!currentPin) return { ok: false as const, error: "Current PIN is required" };
    if (currentPin !== String(acc.pin ?? "")) return { ok: false as const, error: "Invalid current PIN" };

    if (hasPassword && typeof acc.password === "string" && acc.password.length > 0) {
      const currentPassword = String(body?.currentPassword ?? "");
      if (!currentPassword) return { ok: false as const, error: "Current password is required" };
      const match = await bcrypt.compare(currentPassword, acc.password).catch(() => false);
      if (match || currentPassword === acc.password) return { ok: true as const };
      return { ok: false as const, error: "Invalid current password" };
    }
    return { ok: true as const };
  };

  const sendResendEmail = async (args: { to: string; subject: string; html: string; text: string }) => {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.log("[EMAIL MOCK]", { to: args.to, subject: args.subject });
        return true;
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "onboarding@resend.dev",
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend API Error:", errText);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[EMAIL SEND ERROR]", e);
      return false;
    }
  };

  const upsertEmailVerificationCode = async (email: string) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return { ok: false as const, error: "Invalid email" };

    const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
    if (!verTable.rows?.[0]?.r) {
      return { ok: false as const, error: "Database missing email_verification_codes table. Run migrations." };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verification_codes (email, account_number, code, expires_at, created_at, verified_at)
       VALUES ($1,$2,$3,$4,now(),NULL)
       ON CONFLICT (email) DO UPDATE SET
         code = EXCLUDED.code,
         expires_at = EXCLUDED.expires_at,
         account_number = EXCLUDED.account_number,
         verified_at = NULL,
         created_at = now()`,
      [normalizedEmail, session, code, expiresAt]
    );

    const sent = await sendResendEmail({
      to: normalizedEmail,
      subject: "Verify your VeemahPay email change",
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
      text: `Your verification code is ${code}. It expires in 30 minutes.`,
    });
    if (!sent) return { ok: false as const, error: "Failed to send verification email" };

    const showDevCode =
      process.env.NODE_ENV !== "production" &&
      (process.env.DEV_SHOW_RESET_CODE === "1" || process.env.DEV_SHOW_RESET_CODE === "true");

    return { ok: true as const, dev_code: showDevCode ? code : undefined };
  };

  try {
    if (action === "update_profile") {
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const nextName = name || "";
      const nextEmail = email || "";

      const nameChanged = !!nextName && String(nextName) !== String(acc.name ?? "");
      const emailChanged =
        !!nextEmail && String(nextEmail).toLowerCase() !== String(acc.email ?? "").toLowerCase();

      if (!nameChanged && !emailChanged) {
        return NextResponse.json({ error: "No changes provided" }, { status: 400 });
      }

      const verified = await verifySensitive();
      if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

      let updatedAccount: any = null;

      if (nameChanged) {
        const upd = await pool.query(
          `UPDATE public.accounts SET name = $1 WHERE account_number = $2 RETURNING account_number, name${hasEmail ? ", email" : ""}`,
          [nextName, session]
        );
        updatedAccount = upd.rows[0] ?? null;
      }

      if (emailChanged) {
        if (!hasEmail) return NextResponse.json({ error: "Email updates unavailable" }, { status: 400 });
        if (!isValidEmail(nextEmail)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

        const exists = await pool.query(
          `SELECT 1 FROM public.accounts WHERE email IS NOT NULL AND LOWER(email) = LOWER($1) AND account_number <> $2`,
          [nextEmail, session]
        );
        if ((exists.rowCount ?? 0) > 0) {
          return NextResponse.json({ error: "Email already in use" }, { status: 409 });
        }

        const sent = await upsertEmailVerificationCode(nextEmail);
        if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 500 });

        return NextResponse.json({
          ok: true,
          verification_required: true,
          email: nextEmail,
          dev_code: sent.dev_code,
          account: updatedAccount ?? { account_number: acc.account_number, name: updatedAccount?.name ?? acc.name, ...(hasEmail ? { email: acc.email } : {}) },
        });
      }

      return NextResponse.json({
        ok: true,
        account: updatedAccount ?? { account_number: acc.account_number, name: acc.name, ...(hasEmail ? { email: acc.email } : {}) },
      });
    }

    if (action === "change_pin") {
      const newPin = String(body?.newPin ?? "");
      const confirmPin = String(body?.confirmPin ?? "");

      if (!newPin || !confirmPin) {
        return NextResponse.json({ error: "PIN fields are required" }, { status: 400 });
      }
      if (newPin !== confirmPin) return NextResponse.json({ error: "PINs do not match" }, { status: 400 });
      if (!/^\d{5}$/.test(newPin)) return NextResponse.json({ error: "PIN must be exactly 5 digits" }, { status: 400 });

      const verified = await verifySensitive();
      if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

      const updates: string[] = ["pin = $1"];
      if (hasFailedAttempts) updates.push("failed_attempts = 0");
      const upd = await pool.query(
        `UPDATE public.accounts SET ${updates.join(", ")} WHERE account_number = $2 RETURNING account_number`,
        [newPin, session]
      );
      if (upd.rowCount === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (action === "change_password") {
      if (!hasPassword) return NextResponse.json({ error: "Password updates unavailable" }, { status: 400 });

      const newPassword = String(body?.newPassword ?? "");
      const confirmPassword = String(body?.confirmPassword ?? "");
      if (!newPassword || !confirmPassword) return NextResponse.json({ error: "Password fields are required" }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      if (newPassword !== confirmPassword) return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });

      const verified = await verifySensitive();
      if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      const updates: string[] = ["password = $1"];
      if (hasFailedAttempts) updates.push("failed_attempts = 0");
      const upd = await pool.query(
        `UPDATE public.accounts SET ${updates.join(", ")} WHERE account_number = $2`,
        [hashed, session]
      );
      if (upd.rowCount === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });

      if (hasEmail && typeof acc.email === "string" && acc.email.includes("@")) {
        const now = new Date();
        const ip = getClientIp(req);
        const ua = req.headers.get("user-agent") || "";
        const location = getApproxLocation(req);
        const when = formatDateForEmail(now);

        const subject = "Your VeemahPay password was changed";
        const text = [
          "Your VeemahPay password was changed successfully.",
          "",
          `Date: ${when}`,
          `IP: ${ip || "Unknown"}`,
          `Location: ${location || "Unknown"}`,
          `Device: ${ua || "Unknown"}`,
          "",
          "If you did not do this, reset your password immediately.",
        ].join("\n");
        const html = [
          `<p>Your VeemahPay password was changed successfully.</p>`,
          `<p><strong>Date:</strong> ${when}</p>`,
          `<p><strong>IP:</strong> ${ip || "Unknown"}</p>`,
          `<p><strong>Location:</strong> ${location || "Unknown"}</p>`,
          `<p><strong>Device:</strong> ${ua || "Unknown"}</p>`,
          `<p>If you did not do this, reset your password immediately.</p>`,
        ].join("");

        try {
          await sendResendEmail({ to: acc.email, subject, html, text });
        } catch {}
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "verify_email_change") {
      if (!hasEmail) return NextResponse.json({ error: "Email updates unavailable" }, { status: 400 });

      const email = String(body?.email ?? "").trim().toLowerCase();
      const code = String(body?.code ?? "").trim();
      if (!email || !code) return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
      if (!isValidEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

      const verified = await verifySensitive();
      if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

      const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
      if (!verTable.rows?.[0]?.r) {
        return NextResponse.json({ error: "Database missing email_verification_codes table. Run migrations." }, { status: 500 });
      }

      const rec = await pool.query(
        `SELECT expires_at, verified_at FROM public.email_verification_codes WHERE email = $1 AND code = $2 AND account_number = $3`,
        [email, code, session]
      );
      if (rec.rowCount === 0) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
      const row = rec.rows[0];
      if (row.verified_at) return NextResponse.json({ error: "Already verified" }, { status: 400 });
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "Code expired" }, { status: 400 });
      }

      const exists = await pool.query(
        `SELECT 1 FROM public.accounts WHERE email IS NOT NULL AND LOWER(email) = LOWER($1) AND account_number <> $2`,
        [email, session]
      );
      if ((exists.rowCount ?? 0) > 0) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }

      const updated = await pool.query(
        `UPDATE public.accounts SET email = $1 WHERE account_number = $2 RETURNING account_number, name, email`,
        [email, session]
      );
      if (updated.rowCount === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });

      await pool.query(`UPDATE public.email_verification_codes SET verified_at = now() WHERE email = $1`, [email]);

      return NextResponse.json({ ok: true, account: updated.rows[0] });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    if (String(err?.code) === "23505") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
