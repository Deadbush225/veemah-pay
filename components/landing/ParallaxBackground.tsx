"use client";
import { useEffect, useMemo, useState } from 'react';

export function ParallaxBackground() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const particles = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => {
      const size = Math.random() * 4 + 2;
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      const delay = Math.random() * 4;
      const parallax = 0.5 + Math.random() * 2;
      return { id: i, size, top, left, delay, parallax };
    });
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Small parallax factor
      const x = (e.clientX - window.innerWidth / 2) / 40;
      const y = (e.clientY - window.innerHeight / 2) / 40;
      setOffset({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', background: 'var(--bg)' }}>
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '70vw',
        height: '70vw',
        background: 'radial-gradient(circle, var(--primary) 0%, transparent 60%)',
        opacity: 0.25,
        borderRadius: '50%',
        transform: `translate(${offset.x * -2}px, ${offset.y * -2}px)`,
        transition: 'transform 0.08s ease-out',
        filter: 'blur(80px)'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-20%',
        width: '60vw',
        height: '60vw',
        background: 'radial-gradient(circle, var(--primary-600) 0%, transparent 60%)',
        opacity: 0.22,
        borderRadius: '50%',
        transform: `translate(${offset.x * 2.5}px, ${offset.y * 2.5}px)`,
        transition: 'transform 0.08s ease-out',
        filter: 'blur(100px)'
      }} />

      <div style={{
        position: 'absolute',
        top: '10%',
        right: '-5%',
        width: '40vw',
        height: '40vw',
        background: 'radial-gradient(circle, var(--text) 0%, transparent 60%)',
        opacity: 0.12,
        borderRadius: '50%',
        transform: `translate(${offset.x * 1.2}px, ${offset.y * -1.2}px)`,
        transition: 'transform 0.08s ease-out',
        filter: 'blur(80px)'
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(120deg, rgba(58,182,255,0.15), rgba(10,107,255,0) 70%)',
        mixBlendMode: 'soft-light'
      }} />

      {ready && particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: 'var(--primary)',
            opacity: 0.6,
            transform: `translate(${offset.x * p.parallax}px, ${offset.y * p.parallax}px)`,
            animation: `twinkle 4s ease-in-out ${p.delay}s infinite, float 18s ease-in-out ${p.delay}s infinite`,
            boxShadow: '0 0 10px rgba(10,107,255,0.4)'
          }}
        />
      ))}

      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.2
      }} />
    </div>
  );
}
