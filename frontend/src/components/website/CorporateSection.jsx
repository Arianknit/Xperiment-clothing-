import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, Building2, Truck, BadgeCheck, HeadphonesIcon } from 'lucide-react';

const FEATURES = [
  {
    Icon: Building2,
    title: 'Bulk & Volume Orders',
    desc: 'Competitive pricing on large-quantity orders for corporates, retailers, and distributors.',
  },
  {
    Icon: BadgeCheck,
    title: 'Custom Branding & Labels',
    desc: 'Private labelling and custom branding available — your logo, your identity, our quality.',
  },
  {
    Icon: Truck,
    title: 'Pan-India Delivery',
    desc: 'Reliable dispatch and timely delivery across all major cities and states in India.',
  },
  {
    Icon: HeadphonesIcon,
    title: 'Dedicated Account Support',
    desc: 'A dedicated point of contact for every corporate account — from sampling to dispatch.',
  },
];

const POINTS = [
  'Uniforms & workwear for teams and organisations',
  'Seasonal bulk stock for retail chains',
  'Private label manufacturing under your brand',
  'Custom colour, size, and packaging options',
  'Consistent quality across every batch',
  'Flexible MOQ based on order requirements',
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function CorporateSection() {
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

        {/* Top banner */}
        <div style={{
          backgroundColor: '#141414',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: '20px',
          overflow: 'hidden',
          marginBottom: '5rem',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.85s ease-out',
          position: 'relative',
        }}>
          {/* Background pattern */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.025) 40px, rgba(201,168,76,0.025) 41px)`,
          }} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 0,
            position: 'relative',
          }}>
            {/* Left */}
            <div style={{ padding: '3.5rem', borderRight: '1px solid rgba(201,168,76,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
                <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>Corporate Orders</span>
              </div>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                fontWeight: '700', color: '#fff', lineHeight: 1.2, marginBottom: '1.25rem',
              }}>
                We Supply to<br />
                <span style={{ color: '#C9A84C' }}>Businesses & Brands</span>
              </h2>
              <p style={{ color: '#a0a0a0', lineHeight: 1.85, fontSize: '15px', marginBottom: '2rem' }}>
                Arian Knit Fab is a trusted manufacturing partner for corporates, retailers,
                wholesalers, and brands across India. Whether you need uniforms, seasonal stock,
                or a fully private-labelled product line — we deliver at scale without compromising quality.
              </p>
              <button onClick={() => scrollTo('contact')} style={{
                backgroundColor: '#C9A84C', color: '#0A0A0A',
                border: 'none', padding: '14px 32px', borderRadius: '7px',
                fontSize: '14px', fontWeight: '700', letterSpacing: '0.4px',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8C96A'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#C9A84C'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Get Corporate Quote <ArrowRight size={15} />
              </button>
            </div>

            {/* Right — checklist */}
            <div style={{ padding: '3.5rem' }}>
              <div style={{ color: '#666', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
                What We Offer
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {POINTS.map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CheckCircle size={16} color="#C9A84C" style={{ marginTop: '2px', minWidth: '16px' }} />
                    <span style={{ color: '#ccc', fontSize: '14px', lineHeight: 1.6 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}>
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <div key={i} style={{
              backgroundColor: '#141414',
              border: '1px solid #222',
              borderRadius: '14px',
              padding: '2rem',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `all 0.7s ease-out ${0.1 + i * 0.1}s`,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem',
              }}>
                <Icon size={22} color="#C9A84C" />
              </div>
              <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '0.6rem' }}>{title}</h3>
              <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.75 }}>{desc}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
