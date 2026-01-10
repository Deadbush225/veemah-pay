"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<"email" | "code">("email");
  const [phase, setPhase] = useState<"code" | "password">("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const sendCode = async () => {
    if (!email) { setError("Enter your email"); return; }
    setPending(true);
    setError(null);
  try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to send code");
      setMessage(data.message);
      if (process.env.NEXT_PUBLIC_DEV_SHOW_RESET_CODE === "1" || process.env.NEXT_PUBLIC_DEV_SHOW_RESET_CODE === "true") {
        if (data.dev_code) setDevCode(data.dev_code);
      }
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async () => {
    if (!code) { setError("Enter the code"); return; }
    if (phase === "code") {
      if (!/^[0-9]{6}$/.test(code.trim())) { setError("Code must be 6 digits"); return; }
      
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/verify-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid code");
        setPhase("password");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setPending(false);
      }
      return;
    }
    if (!newPassword || newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccessModalOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="container" style={{ maxWidth: 400, width: '100%' }}>
          <div className="card" style={{ padding: '32px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '24px', marginBottom: 8 }}>{t('forgot.title')}</h2>
            <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: '14px' }}>
              {step === "email" ? t('forgot.subtitle_email') : t('forgot.subtitle_code')}
            </p>
            
            {error && <div style={{ color: "var(--danger)", background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '8px', marginBottom: 16, fontSize: '14px' }}>{error}</div>}
            {message && <div style={{ color: "var(--success)", background: 'rgba(0,255,0,0.1)', padding: '10px', borderRadius: '8px', marginBottom: 16, fontSize: '14px' }}>{message}</div>}
            {devCode && <div style={{ color: "var(--text)", background: 'rgba(0,0,0,0.08)', padding: '10px', borderRadius: '8px', marginBottom: 16, fontSize: '14px' }}>DEV Code: <strong>{devCode}</strong></div>}
            
            {step === "email" ? (
              <div style={{ display: "grid", gap: 16, width: "100%" }}>
                <input 
                  type="email" 
                  placeholder={t('login.email')} 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  style={{ padding: '12px', background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                />
                <button className="btn primary" onClick={sendCode} disabled={pending} style={{ padding: '12px' }}>
                  {pending ? t('forgot.sending') : t('forgot.send_code')}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16, width: "100%" }}>
                <input 
                  placeholder={t('forgot.code_placeholder')} 
                  value={code} 
                  onChange={e => setCode(e.target.value)} 
                  style={{ padding: '12px', background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                />
                {phase === "code" ? (
                  <button className="btn primary" onClick={resetPassword} disabled={pending} style={{ padding: '12px' }}>
                    {t('forgot.continue')}
                  </button>
                ) : (
                  <>
                    <PasswordInput 
                      placeholder={t('forgot.new_password_placeholder')} 
                      value={newPassword} 
                      onChange={setNewPassword} 
                      style={{ padding: '12px', background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                    />
                    <PasswordInput 
                      placeholder={t('forgot.confirm_password_placeholder')} 
                      value={confirmPassword} 
                      onChange={setConfirmPassword} 
                      style={{ padding: '12px', background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                    />
                    <button className="btn primary" onClick={resetPassword} disabled={pending} style={{ padding: '12px' }}>
                      {pending ? t('forgot.resetting') : t('forgot.reset_btn')}
                    </button>
                  </>
                )}
                <button className="btn ghost" onClick={() => setStep("email")}>{t('forgot.back')}</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal open={successModalOpen} onClose={() => router.push("/login")}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Password Updated!</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
            Your password has been successfully reset. You can now login with your new credentials.
          </p>
          <button 
            className="btn primary" 
            onClick={() => router.push("/login")}
            style={{ width: '100%', padding: '12px' }}
          >
            Login Now
          </button>
        </div>
      </Modal>
    </main>
  );
}
