import React, { useEffect, useRef, useState } from 'react';
import { Shirt, Layers, Activity, Package, Star, Users, Shield, Award } from 'lucide-react';

const PRODUCTS = [
  {
    Icon: Shirt,   category: "Men's & Kids'", name: 'Round Neck T-Shirts',
    desc: 'Soft, breathable cotton blend for all-day comfort. Wide range of sizes, fits, and colours.',
  },
  {
    Icon: Award,   category: "Men's",          name: 'Polo T-Shirts',
    desc: 'Smart collared t-shirts in premium pique fabric — perfect for work and leisure.',
  },
  {
    Icon: Layers,  category: "Men's & Kids'", name: 'Shorts',
    desc: 'Lightweight and comfortable shorts for active lifestyles. Multiple lengths and styles.',
  },
  {
    Icon: Activity,category: "Men's & Kids'", name: 'Track Pants',
    desc: 'Stretch-comfort track pants for sport and everyday wear with elastic drawstring waist.',
  },
  {
    Icon: Package, category: "Men's & Kids'", name: 'Coord Sets',
    desc: 'Matching top and bottom coord sets — effortlessly stylish for casual and lounge wear.',
  },
  {
    Icon: Star,    category: "Kids'",          name: "Kids' T-Shirts",
    desc: 'Playful and durable t-shirts made with child-safe fabrics and vibrant designs.',
  },
  {
    Icon: Users,   category: "Kids'",          name: "Kids' Track Pants",
    desc: 'Comfortable, durable track pants built for active children with easy elastic waistbands.',
  },
  {
    Icon: Shield,  category: "Men's & Kids'", name: 'Innerwear Basics',
    desc: 'Premium cotton innerwear providing all-day comfort, trusted for quality and durability.',
  },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function ProductsSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ backgroundColor: '#111111', padding: '110px 2rem' }}>
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
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>Our Products</span>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
          </div>
          <h2 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700', color: '#fff', marginBottom: '1rem',
          }}>
            Complete Hosiery Range
          </h2>
          <p style={{ color: '#777', fontSize: '16px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            From everyday essentials to fashion-forward styles — we manufacture a comprehensive
            range of men's and kids' hosiery under one roof.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          {PRODUCTS.map(({ Icon, category, name, desc }, i) => (
            <div key={i} style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #252525',
              borderRadius: '14px', padding: '2rem',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(28px)',
              transition: `all 0.65s ease-out ${(i % 4) * 0.08}s`,
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.38)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.backgroundColor = '#1E1E1E';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#252525';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = '#1A1A1A';
              }}
            >
              <div style={{
                width: '50px', height: '50px', borderRadius: '12px',
                backgroundColor: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem',
              }}>
                <Icon size={22} color="#C9A84C" />
              </div>
              <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{category}</div>
              <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '0.75rem', lineHeight: 1.3 }}>{name}</h3>
              <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.75 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{
          textAlign: 'center', marginTop: '5rem',
          opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.6s',
        }}>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '15px' }}>
            Looking for bulk orders, custom manufacturing, or private label?
          </p>
          <button onClick={() => scrollTo('contact')} style={{
            backgroundColor: 'transparent', color: '#C9A84C',
            border: '1px solid #C9A84C', padding: '14px 38px',
            borderRadius: '7px', fontSize: '14px', fontWeight: '500',
            letterSpacing: '0.4px', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Contact Us for Bulk Orders
          </button>
        </div>
      </div>
    </div>
  );
}
