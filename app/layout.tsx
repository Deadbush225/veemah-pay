export const metadata = {
  title: 'VeemahPay',
  description: 'VeemahPay — Modern banking landing page',
};

import './globals.css';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { LanguageProvider } from '@/components/ui/LanguageProvider';
import { Chatbot } from '@/components/ui/Chatbot';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get('language')?.value as 'en' | 'tl' | undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s?s:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}
        </Script>
      </head>
      <body>
        <LanguageProvider initialLanguage={langCookie === 'tl' ? 'tl' : 'en'}>
          <ThemeProvider>
            <ToastProvider>
              {children}
              <Chatbot />
            </ToastProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
