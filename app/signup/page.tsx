"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from '@/components/nav/Header';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { ParallaxBackground } from '@/components/landing/ParallaxBackground';

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    setError(null);

    // Validation
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Valid email is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits"); return; }
    if (!termsAccepted) { setError("You must accept the Terms of Service"); return; }

    setPending(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          pin,
          initial_balance: initialBalance ? Number(initialBalance) : 0,
          terms_accepted: true
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Sign up failed");
        return;
      }
      const acc = data?.account?.account_number;
      if (acc === "0000") {
        router.replace("/admin");
      } else {
        router.replace("/user");
      }
    } catch (e: any) {
      setError(e?.message || "Sign up failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <ParallaxBackground />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="container" style={{ maxWidth: 600, width: '100%' }}>
            <div className="card" style={{ alignItems: "stretch", padding: '40px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', background: 'var(--card)' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'var(--text)' }}>{t('signup.create_account')}</h2>
              <p style={{ margin: '0 0 32px 0', color: 'var(--muted)', fontSize: '14px' }}>
                {t('signup.subtitle')}
              </p>
              
              {error && (
                <div style={{ 
                  background: 'rgba(255, 0, 0, 0.1)', 
                  color: 'var(--danger)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '24px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gap: 20, width: "100%" }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{t('signup.name')}</label>
                  <input placeholder={t('signup.name_placeholder')} value={name} onChange={e => setName(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{t('signup.email')}</label>
                  <input placeholder={t('signup.email_placeholder')} type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.password')}</label>
                  <input placeholder={t('signup.password_placeholder')} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.confirm_password')}</label>
                  <input placeholder={t('signup.confirm_password_placeholder')} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.pin')}</label>
                  <input placeholder={t('signup.pin_placeholder')} value={pin} onChange={e => setPin(e.target.value)} maxLength={4} style={{ padding: '12px 16px', fontSize: '16px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: 500 }}>{t('signup.initial_balance')}</label>
                  <input placeholder={t('signup.initial_balance_placeholder')} value={initialBalance} onChange={e => setInitialBalance(e.target.value)} style={{ padding: '12px 16px', fontSize: '16px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input type="checkbox" id="terms" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                <label htmlFor="terms" style={{ fontSize: '14px' }}>{t('signup.terms')}</label>
              </div>

              <button 
                className="btn primary" 
                onClick={submit} 
                disabled={pending}
                style={{ padding: '14px', fontSize: '16px', fontWeight: 600, marginTop: 8 }}
              >
                {pending ? t('signup.creating') : t('signup.submit')}
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
