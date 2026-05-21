import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function HeroSection() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      backgroundImage: `
        repeating-linear-gradient(45deg, transparent, transparent 48px, rgba(201,168,76,0.028) 48px, rgba(201,168,76,0.028) 49px),
        repeating-linear-gradient(-45deg, transparent, transparent 48px, rgba(201,168,76,0.028) 48px, rgba(201,168,76,0.028) 49px)
      `,
    }}>
      {/* Decorative rings */}
      {[600, 420, 260].map((size, i) => (
        <div key={i} style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: `${size}px`, height: `${size}px`,
          borderRadius: '50%',
          border: `1px solid rgba(201,168,76,${0.06 - i * 0.015})`,
          pointerEvents: 'none',
        }} />
      ))}
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        border: '1px solid rgba(201,168,76,0.04)', pointerEvents: 'none',
      }} />

      {/* Main content */}
      <div style={{
        textAlign: 'center', maxWidth: '900px',
        padding: '0 2rem', zIndex: 1,
        paddingTop: '80px',
      }}>
        {/* Label */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '14px',
          marginBottom: '2.5rem',
          animation: 'fadeInUp 0.8s ease-out both',
        }}>
          <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
          <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: '500' }}>
            Established 2018 · Tirupur, India
          </span>
          <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.6rem, 7vw, 5.5rem)',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontWeight: '800',
          lineHeight: 1.08,
          marginBottom: '1.75rem',
          color: '#ffffff',
          animation: 'fadeInUp 0.8s ease-out 0.12s both',
        }}>
          Crafting Excellence<br />
          <span style={{
            background: 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 50%, #C9A84C 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            In Every Thread
          </span>
        </h1>

        {/* Sub-text */}
        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
          color: '#a0a0a0',
          lineHeight: 1.85,
          maxWidth: '680px',
          margin: '0 auto 3rem',
          animation: 'fadeInUp 0.8s ease-out 0.24s both',
        }}>
          Arian Knit Fab (AKF) — Tirupur's trusted hosiery manufacturer delivering premium quality
          men's and kids' clothing under the{' '}
          <strong style={{ color: '#C9A84C', fontWeight: '600' }}>Xperiment</strong> and{' '}
          <strong style={{ color: '#C9A84C', fontWeight: '600' }}>UnitedHart</strong> brands.
        </p>

        {/* CTA row */}
        <div style={{
          display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap',
          animation: 'fadeInUp 0.8s ease-out 0.36s both',
        }}>
          <button onClick={() => scrollTo('products')} style={{
            backgroundColor: '#C9A84C', color: '#0A0A0A',
            border: 'none', padding: '16px 38px', borderRadius: '7px',
            fontSize: '15px', fontWeight: '700', letterSpacing: '0.4px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8C96A'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#C9A84C'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Explore Products <ArrowRight size={16} />
          </button>

          <button onClick={() => scrollTo('about')} style={{
            backgroundColor: 'transparent', color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.28)', padding: '16px 38px',
            borderRadius: '7px', fontSize: '15px', fontWeight: '500',
            letterSpacing: '0.4px', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.color = '#ffffff'; }}
          >
            Our Story
          </button>
        </div>

        {/* Brand pills */}
        <div style={{
          marginTop: '3.5rem',
          display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
          animation: 'fadeInUp 0.8s ease-out 0.48s both',
        }}>
          {['Xperiment', 'UnitedHart', "Men's Hosiery", "Kids' Hosiery", 'Corporate Orders', 'Global Exports'].map((tag, i) => (
            <span key={i} style={{
              border: '1px solid rgba(201,168,76,0.3)',
              color: '#888', padding: '6px 16px',
              borderRadius: '100px', fontSize: '12px', letterSpacing: '0.3px',
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div onClick={() => scrollTo('about')} style={{
        position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        cursor: 'pointer', animation: 'fadeIn 1s ease-out 1s both',
      }}>
        <span style={{ color: '#555', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>Scroll</span>
        <ChevronDown size={18} color="#C9A84C" style={{ animation: 'scrollBounce 2s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
