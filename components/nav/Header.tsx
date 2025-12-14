"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logo from "../../assets/img/veemahpay-logo.png";
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { LanguageToggle, useLanguage } from "@/components/ui/LanguageProvider";

type Me = { authenticated: boolean; account?: { account_number: string; name: string; balance: number; status: string } };

export function Header(){
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(setMe).catch(() => setMe({ authenticated: false } as any));
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
  };

  const NavLink = ({ href, label }:{ href: string; label: string }) => (
    <Link href={href} className={pathname === href ? "active" : ""}>{label}</Link>
  );

  const isAdmin = me?.authenticated && me?.account?.account_number === "0000";

  return (
    <header className={`site-header ${open ? "mobile-open" : ""}`}>
      <div className="inner container" style={{ justifyContent: "space-between" }}>
        <div className="brand">
          <Link href="/" aria-label="Go to Home">
            <Image src={logo} alt="VeemahPay" width={180} height={50} priority />
          </Link>
        </div>
        <nav className={`top-nav ${open ? "open" : ""}`}>
          <NavLink href="/" label={t('nav.home')} />
          {!me?.authenticated && (
            <>
              <NavLink href="/login" label={t('nav.login')} />
              <NavLink href="/signup" label={t('nav.signup')} />
            </>
          )}
          {me?.authenticated && (
            <>
              {isAdmin ? <NavLink href="/admin" label={t('nav.admin')} /> : <NavLink href="/user" label={t('nav.dashboard')} />}
              <button className="btn ghost" onClick={logout}>{t('nav.signout')}</button>
              <ThemeToggle />
              <LanguageToggle />
              <div className="avatar" title={me?.account?.name ?? "User"}>{String(me?.account?.name ?? "U").slice(0,1).toUpperCase()}</div>
              <div className="quick-info">
                <span>{me?.account?.name}</span>
                <span className="muted">₱{Number(me?.account?.balance ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
          {!me?.authenticated && (
            <>
              <ThemeToggle />
              <LanguageToggle />
            </>
          )}
        </nav>
        <button className="hamburger" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
