"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/nav/Header";
import { useLanguage } from "@/components/ui/LanguageProvider";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/ui/AuthProvider";
import { PasswordInput } from "@/components/ui/PasswordInput";

type Account = {
  account_number: string;
  name: string;
  email?: string | null;
  hasPassword?: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const toast = useToast();
  const { me, refreshMe } = useAuth();

  const account = useMemo(() => {
    if (!me?.authenticated || !me.account) return null;
    return me.account as Account;
  }, [me]);

  const [loading, setLoading] = useState(true);

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [profileCurrentPin, setProfileCurrentPin] = useState("");
  const [profilePending, setProfilePending] = useState(false);
  const [emailChangeEmail, setEmailChangeEmail] = useState<string | null>(null);
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [emailVerifyPending, setEmailVerifyPending] = useState(false);
  const [emailResendPending, setEmailResendPending] = useState(false);

  const [pinCurrent, setPinCurrent] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinPending, setPinPending] = useState(false);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwPin, setPwPin] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwPending, setPwPending] = useState(false);

  const readJson = async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!me?.authenticated) {
      router.replace("/login");
      return;
    }
    setProfileName(String(me.account?.name ?? ""));
    setProfileEmail(String((me.account as any)?.email ?? ""));
    setEmailChangeEmail(null);
    setEmailChangeCode("");
  }, [loading, me, router]);

  const submitProfile = async () => {
    if (profilePending) return;
    if (!account) return;

    const name = profileName.trim();
    const email = profileEmail.trim();

    const nameChanged = name !== String(account.name ?? "");
    const emailChanged = email.toLowerCase() !== String(account.email ?? "").toLowerCase();

    if (!nameChanged && !emailChanged) {
      toast.show(t("settings.no_changes"), "error");
      return;
    }
    if (emailChanged && !email) {
      toast.show(t("settings.email_required"), "error");
      return;
    }

    if (!profileCurrentPin) {
      toast.show(t("settings.current_pin_required"), "error");
      return;
    }
    if (account.hasPassword && !profileCurrentPassword) {
      toast.show(t("settings.current_password_required"), "error");
      return;
    }

    setProfilePending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          name: nameChanged ? name : undefined,
          email: emailChanged ? email : undefined,
          currentPassword: profileCurrentPassword || undefined,
          currentPin: profileCurrentPin || undefined,
        }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        toast.show(data?.error || t("settings.update_failed"), "error");
        return;
      }
      if (data?.verification_required) {
        setEmailChangeEmail(String(data?.email ?? email));
        setEmailChangeCode("");
        toast.show(t("settings.verification_sent"), "success");
        return;
      }
      await refreshMe();
      setProfileCurrentPassword("");
      setProfileCurrentPin("");
      toast.show(t("settings.profile_updated"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("settings.update_failed"), "error");
    } finally {
      setProfilePending(false);
    }
  };

  const verifyEmailChange = async () => {
    if (emailVerifyPending) return;
    if (!account) return;
    const pendingEmail = String(emailChangeEmail ?? "").trim();
    if (!pendingEmail) return;
    if (!emailChangeCode.trim()) {
      toast.show(t("settings.verification_code_required"), "error");
      return;
    }
    if (!profileCurrentPin) {
      toast.show(t("settings.current_pin_required"), "error");
      return;
    }
    if (account.hasPassword && !profileCurrentPassword) {
      toast.show(t("settings.current_password_required"), "error");
      return;
    }
    setEmailVerifyPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_email_change",
          email: pendingEmail,
          code: emailChangeCode.trim(),
          currentPassword: profileCurrentPassword || undefined,
          currentPin: profileCurrentPin || undefined,
        }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        toast.show(data?.error || t("settings.update_failed"), "error");
        return;
      }
      await refreshMe();
      setEmailChangeEmail(null);
      setEmailChangeCode("");
      setProfileCurrentPassword("");
      setProfileCurrentPin("");
      toast.show(t("settings.email_updated"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("settings.update_failed"), "error");
    } finally {
      setEmailVerifyPending(false);
    }
  };

  const resendEmailChangeCode = async () => {
    if (emailResendPending) return;
    const pendingEmail = String(emailChangeEmail ?? "").trim();
    if (!pendingEmail) return;
    setEmailResendPending(true);
    try {
      const res = await fetch("/api/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        toast.show(data?.error || t("settings.update_failed"), "error");
        return;
      }
      toast.show(t("settings.code_resent"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("settings.update_failed"), "error");
    } finally {
      setEmailResendPending(false);
    }
  };



  const submitPassword = async () => {
    if (pwPending) return;
    if (!account) return;
    if (!pwNew || !pwConfirm) {
      toast.show(t("settings.password_fields_required"), "error");
      return;
    }
    if (pwNew.length < 8) {
      toast.show(t("settings.password_min_8"), "error");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.show(t("settings.password_mismatch"), "error");
      return;
    }
    if (!pwPin) {
      toast.show(t("settings.current_pin_required"), "error");
      return;
    }
    if (account.hasPassword && !pwCurrent) {
      toast.show(t("settings.current_password_required"), "error");
      return;
    }
    setPwPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword: pwCurrent || undefined,
          currentPin: pwPin || undefined,
          newPassword: pwNew,
          confirmPassword: pwConfirm,
        }),
      });
      const data: any = await readJson(res);
      if (!res.ok) {
        toast.show(data?.error || t("settings.update_failed"), "error");
        return;
      }
      setPwCurrent("");
      setPwPin("");
      setPwNew("");
      setPwConfirm("");
      toast.show(t("settings.password_updated"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("settings.update_failed"), "error");
    } finally {
      setPwPending(false);
    }
  };

  if (loading) {
    return (
      <main>
        <Header />
        <section className="container" style={{ padding: 24 }}>
          <div className="muted">{t("settings.loading")}</div>
        </section>
      </main>
    );
  }

  if (!account) {
    return (
      <main>
        <Header />
        <section className="container" style={{ padding: 24 }}>
          <div className="muted">{t("settings.loading")}</div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="container" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0 }}>{t("settings.title")}</h1>
            <div className="muted">{t("settings.subtitle")}</div>
          </div>
          <div className="muted">{t("settings.account")}: {account.account_number}</div>
        </div>

        <div
          className="grid gap-16"
          style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
        >
          <div className="card">
            <h2>{t("settings.profile")}</h2>
            <div className="grid grid-cols-1 gap-12">
              <div>
                <label>{t("settings.name")}</label>
                <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>
              <div>
                <label>{t("settings.email")}</label>
                <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {t("settings.email_requires_verification_hint")}
              </div>
              <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <div>
                  <label>{t("settings.current_password_optional")}</label>
                  <PasswordInput value={profileCurrentPassword} onChange={setProfileCurrentPassword} />
                </div>
                {/* <div>
                  <label>{t("settings.current_pin_optional")}</label>
                  <input value={profileCurrentPin} onChange={(e) => setProfileCurrentPin(e.target.value)} />
                </div> */}
              </div>
              {emailChangeEmail && (
                <div className="card" style={{ padding: 12 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{t("settings.email_change_pending")}: {emailChangeEmail}</div>
                  <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", alignItems: "end" }}>
                    <div>
                      <label>{t("settings.verification_code")}</label>
                      <input value={emailChangeCode} onChange={(e) => setEmailChangeCode(e.target.value)} />
                    </div>
                    <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                      <button className="btn" onClick={resendEmailChangeCode} disabled={emailResendPending || emailVerifyPending}>
                        {emailResendPending ? t("settings.saving") : t("settings.resend_code")}
                      </button>
                      <button className="btn primary" onClick={verifyEmailChange} disabled={emailVerifyPending}>
                        {emailVerifyPending ? t("settings.saving") : t("settings.verify")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <button className="btn primary" onClick={submitProfile} disabled={profilePending || !!emailChangeEmail}>
                {profilePending ? t("settings.saving") : t("settings.save_profile")}
              </button>
            </div>
          </div>

          <div className="card">
            <h2>{t("settings.security")}</h2>
            <div className="grid grid-cols-1 gap-16">

              <div className="card" style={{ padding: 12 }}>
                <h3 style={{ margin: 0 }}>{t("settings.change_password")}</h3>
                <div className="grid grid-cols-1 gap-12">
                  <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    <div>
                      <label>{t("settings.current_password_optional")}</label>
                      <PasswordInput value={pwCurrent} onChange={setPwCurrent} />
                    </div>
                    {/* <div>
                      <label>{t("settings.current_pin_optional")}</label>
                      <input value={pwPin} onChange={(e) => setPwPin(e.target.value)} />
                    </div> */}
                  </div>
                  <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    <div>
                      <label>{t("settings.new_password")}</label>
                      <PasswordInput value={pwNew} onChange={setPwNew} />
                    </div>
                    <div>
                      <label>{t("settings.confirm_password")}</label>
                      <PasswordInput value={pwConfirm} onChange={setPwConfirm} />
                    </div>
                  </div>
                  <button className="btn" onClick={submitPassword} disabled={pwPending}>
                    {pwPending ? t("settings.saving") : t("settings.save_password")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
