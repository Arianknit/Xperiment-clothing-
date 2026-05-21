import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Zap, Heart } from 'lucide-react';

const BRANDS = [
  {
    Icon: Zap,
    name: 'Xperiment',
    tagline: 'Bold. Trendy. Experimental.',
    description:
      'Xperiment is where fashion meets function. Designed for the modern man and today\'s children, Xperiment pushes the boundaries of everyday hosiery with contemporary silhouettes, vibrant colour palettes, and trend-forward designs. From statement t-shirts to stylish coord sets — Xperiment makes every look count.',
    products: ['Graphic T-Shirts', 'Coord Sets', 'Trendy Shorts', 'Track Pants', "Kids' Activewear"],
    glow: 'rgba(201,168,76,0.12)',
  },
  {
    Icon: Heart,
    name: 'UnitedHart',
    tagline: 'Classic. Comfortable. Trusted.',
    description:
      'UnitedHart is the family\'s everyday companion. Rooted in the values of comfort, quality, and durability, this brand delivers timeless hosiery basics that hold up through every wash and every adventure. Whether for daily wear or casual outings, UnitedHart stands for trust.',
    products: ['Round Neck T-Shirts', 'Basic Shorts', 'Track Pants', "Kids' Essentials", 'Innerwear Basics'],
    glow: 'rgba(166,136,48,0.10)',
  },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function BrandsSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ backgroundColor: '#0F0F0F', padding: '110px 2rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          textAlign: 'center', marginBottom: '5rem',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '1.75rem' }}>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>Our Brands</span>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
          </div>
          <h2 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700', color: '#fff', marginBottom: '1rem',
          }}>
            Two Identities,<br />One Commitment to Quality
          </h2>
          <p style={{ color: '#777', fontSize: '16px', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            Under AKF, two distinct brands serve different styles and sensibilities —
            united by the same uncompromising standard of craftsmanship.
          </p>
        </div>

        {/* Brand cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
          {BRANDS.map(({ Icon, name, tagline, description, products, glow }, i) => (
            <div key={i} style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #252525',
              borderRadius: '18px', padding: '3rem',
              position: 'relative', overflow: 'hidden',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: `all 0.85s ease-out ${i * 0.18}s`,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.45)'; e.currentTarget.style.transform = 'translateY(-6px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Top gradient glow */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '220px',
                background: `linear-gradient(180deg, ${glow} 0%, transparent 100%)`,
                pointerEvents: 'none', borderRadius: '18px 18px 0 0',
              }} />

              <div style={{ position: 'relative' }}>
                {/* Icon */}
                <div style={{
                  width: '66px', height: '66px', borderRadius: '16px',
                  backgroundColor: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.75rem',
                }}>
                  <Icon size={30} color="#C9A84C" />
                </div>

                {/* Name */}
                <h3 style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '2.1rem', fontWeight: '700',
                  color: '#fff', marginBottom: '0.5rem',
                }}>{name}</h3>

                {/* Tagline */}
                <p style={{ color: '#C9A84C', fontSize: '12px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: '500', marginBottom: '1.5rem' }}>
                  {tagline}
                </p>

                {/* Divider */}
                <div style={{ width: '44px', height: '2px', backgroundColor: '#C9A84C', marginBottom: '1.75rem' }} />

                {/* Description */}
                <p style={{ color: '#a0a0a0', lineHeight: 1.85, fontSize: '14px', marginBottom: '2.25rem' }}>
                  {description}
                </p>

                {/* Products */}
                <div style={{ marginBottom: '2.25rem' }}>
                  <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Key Products</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {products.map((p, j) => (
                      <span key={j} style={{
                        backgroundColor: 'rgba(201,168,76,0.08)',
                        border: '1px solid rgba(201,168,76,0.22)',
                        color: '#C9A84C', padding: '5px 14px',
                        borderRadius: '100px', fontSize: '12px',
                      }}>{p}</span>
                    ))}
                  </div>
                </div>

                {/* Enquire CTA */}
                <button onClick={() => scrollTo('contact')} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  color: '#C9A84C', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                  padding: 0, letterSpacing: '0.3px', transition: 'gap 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.gap = '12px'}
                  onMouseLeave={e => e.currentTarget.style.gap = '8px'}
                >
                  Enquire Now <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
