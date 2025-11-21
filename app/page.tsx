import Image from 'next/image';
import heroImg from '@/assets/img/hanzlwi.jpg';
import { Header } from '@/components/nav/Header';
import logo from '../assets/img/veemahpay-logo.png';

export default function Page() {
  return (
    <main>
      <Header />
      <header className="site-header">
        <div className="inner container">
          <Image src={heroImg} alt="VeemahPay hero" style={{ width: '100%', height: 'auto', borderRadius: 12 }} priority />
        </div>
      </header>

      
    </main>
  );
}