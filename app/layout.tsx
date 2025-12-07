export const metadata = {
  title: 'VeemahPay',
  description: 'VeemahPay — Modern banking landing page',
};

import './globals.css';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { LanguageProvider } from '@/components/ui/LanguageProvider';
import { Chatbot } from '@/components/ui/Chatbot';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
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
