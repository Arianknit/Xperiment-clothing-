import React, { useEffect, useRef, useState } from 'react';
import { Shirt, Layers, Activity, Package, Star, Users, Shield, Award } from 'lucide-react';

const PRODUCTS = [
  {
    Icon: Shirt,    category: "Men's", name: "Men's T-Shirt",
    desc: 'Soft, breathable cotton blend t-shirts for all-day comfort. Available in a wide range of sizes and colours.',
  },
  {
    Icon: Activity, category: "Men's", name: "Men's Track Pant",
    desc: 'Stretch-comfort track pants for sport and everyday wear, with elastic drawstring waist and a relaxed fit.',
  },
  {
    Icon: Package,  category: "Men's", name: "Men's Coordinate Set",
    desc: 'Matching top and bottom coord sets — effortlessly stylish for casual outings and lounge wear.',
  },
  {
    Icon: Shield,   category: "Men's", name: "Men's Singlets",
    desc: 'Premium cotton sleeveless vests for everyday comfort. Lightweight, breathable, and durable.',
  },
  {
    Icon: Star,     category: "Kids'", name: "Kids' T-Shirt",
    desc: 'Playful and durable t-shirts made with child-safe fabrics. Vibrant prints and solid colours kids love.',
  },
  {
    Icon: Layers,   category: "Kids'", name: "Kids' Shorts",
    desc: 'Lightweight, comfortable shorts perfect for active children. Elastic waistband for an easy fit.',
  },
  {
    Icon: Users,    category: "Kids'", name: "Kids' Track Pant",
    desc: 'Comfortable, durable track pants built for active kids. Easy pull-on elastic waistband.',
  },
  {
    Icon: Award,    category: "Kids'", name: "Kids' Singlets",
    desc: 'Soft, breathable sleeveless vests in child-safe fabrics — ideal for layering or summer wear.',
  },
  {
    Icon: Package,  category: "Kids'", name: "Kids' Coordinate Set",
    desc: 'Matching top and bottom sets for kids — fun designs, easy to wear, built to last.',
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

        {/* Men's group label */}
        <div style={{ marginBottom: '1.5rem', opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Men's Collection</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#252525' }} />
          </div>
        </div>

        {/* Men's grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '3.5rem',
        }}>
          {PRODUCTS.slice(0, 4).map(({ Icon, category, name, desc }, i) => (
            <ProductCard key={i} Icon={Icon} category={category} name={name} desc={desc} visible={visible} delay={i * 0.08} />
          ))}
        </div>

        {/* Kids' group label */}
        <div style={{ marginBottom: '1.5rem', opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Kids' Collection</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#252525' }} />
          </div>
        </div>

        {/* Kids' grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.25rem',
        }}>
          {PRODUCTS.slice(4).map(({ Icon, category, name, desc }, i) => (
            <ProductCard key={i} Icon={Icon} category={category} name={name} desc={desc} visible={visible} delay={(i + 4) * 0.08} />
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

function ProductCard({ Icon, category, name, desc, visible, delay }) {
  return (
    <div style={{
      backgroundColor: '#1A1A1A',
      border: '1px solid #252525',
      borderRadius: '14px', padding: '2rem',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `all 0.65s ease-out ${delay}s`,
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
  );
}
