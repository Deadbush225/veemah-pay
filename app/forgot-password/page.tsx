"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';

import { useLanguage } from '@/components/ui/LanguageProvider';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setMessage(data.message);
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async () => {
    if (!code || !newPin) { setError("Fill all fields"); return; }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      alert("Password reset successful! Please login.");
      router.push("/login");
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
            
            {step === "email" ? (
              <div style={{ display: "grid", gap: 16, width: "100%" }}>
                <input 
                  type="email" 
                  placeholder={t('login.email')} 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  style={{ padding: '12px' }}
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
                  style={{ padding: '12px' }}
                />
                <input 
                  type="password" 
                  placeholder={t('forgot.new_pin_placeholder')} 
                  value={newPin} 
                  onChange={e => setNewPin(e.target.value)} 
                  style={{ padding: '12px' }}
                />
                <button className="btn primary" onClick={resetPassword} disabled={pending} style={{ padding: '12px' }}>
                  {pending ? t('forgot.resetting') : t('forgot.reset_btn')}
                </button>
                <button className="btn ghost" onClick={() => setStep("email")}>{t('forgot.back')}</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
