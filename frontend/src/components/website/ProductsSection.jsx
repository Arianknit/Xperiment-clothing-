import React, { useEffect, useRef, useState } from 'react';

const PRODUCTS = [
  {
    category: "Men's",
    name: "Men's T-Shirt",
    desc: 'Soft, breathable cotton blend for all-day comfort. Wide range of sizes and colours.',
    img: 'https://images.unsplash.com/photo-TvL5vIgwiwo?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Men's",
    name: "Men's Track Pant",
    desc: 'Stretch-comfort track pants for sport and everyday wear with elastic drawstring waist.',
    img: 'https://images.unsplash.com/photo-FH2IR3XXw4E?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Men's",
    name: "Men's Coordinate Set",
    desc: 'Matching top and bottom coord sets — effortlessly stylish for casual and lounge wear.',
    img: 'https://images.unsplash.com/photo-_nLjk5cRzkA?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Men's",
    name: "Men's Singlets",
    desc: 'Premium cotton sleeveless vests for everyday comfort. Lightweight, breathable, and durable.',
    img: 'https://images.unsplash.com/photo-sJaQ147oSSE?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Kids'",
    name: "Kids' T-Shirt",
    desc: 'Playful and durable t-shirts made with child-safe fabrics and vibrant designs.',
    img: 'https://images.unsplash.com/photo--CUg2tKMHV4?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Kids'",
    name: "Kids' Shorts",
    desc: 'Lightweight, comfortable shorts perfect for active children with an easy elastic waistband.',
    img: 'https://images.unsplash.com/photo-pNjqpqxeKFk?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Kids'",
    name: "Kids' Track Pant",
    desc: 'Comfortable, durable track pants built for active kids with easy pull-on elastic waistband.',
    img: 'https://images.unsplash.com/photo-1604671801908-6f0c6a092c05?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Kids'",
    name: "Kids' Singlets",
    desc: 'Soft, breathable sleeveless vests in child-safe fabrics — ideal for layering or summer wear.',
    img: 'https://images.unsplash.com/photo-9RSHm0aP-sE?w=600&auto=format&fit=crop&q=80',
  },
  {
    category: "Kids'",
    name: "Kids' Coordinate Set",
    desc: 'Matching top and bottom sets for kids — fun designs, easy to wear, built to last.',
    img: 'https://images.unsplash.com/photo-6ia0c3WyjrY?w=600&auto=format&fit=crop&q=80',
  },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

function ProductCard({ category, name, desc, img, visible, delay }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      backgroundColor: '#1A1A1A',
      border: '1px solid #252525',
      borderRadius: '16px',
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `all 0.65s ease-out ${delay}s`,
      display: 'flex',
      flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.45)'; e.currentTarget.style.transform = 'translateY(-5px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Image area */}
      <div style={{ position: 'relative', overflow: 'hidden', height: '220px', backgroundColor: '#111' }}>
        {!imgError ? (
          <img
            src={img}
            alt={name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.4s ease, transform 0.5s ease',
            }}
          />
        ) : (
          /* Fallback gradient when image fails */
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1E1E1E 0%, #252525 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#444', fontSize: '13px' }}>{name}</span>
          </div>
        )}

        {/* Subtle dark gradient overlay at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
          background: 'linear-gradient(to top, rgba(26,26,26,0.9), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Category pill */}
        <div style={{
          position: 'absolute', top: '12px', left: '12px',
          backgroundColor: 'rgba(10,10,10,0.82)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: '100px',
          padding: '4px 12px',
        }}>
          <span style={{ color: '#C9A84C', fontSize: '11px', fontWeight: '600', letterSpacing: '1px' }}>{category}</span>
        </div>
      </div>

      {/* Text area */}
      <div style={{ padding: '1.25rem 1.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '0.6rem', lineHeight: 1.3 }}>{name}</h3>
        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7, flex: 1 }}>{desc}</p>
      </div>
    </div>
  );
}

export default function ProductsSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.06 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const mens = PRODUCTS.filter(p => p.category === "Men's");
  const kids = PRODUCTS.filter(p => p.category === "Kids'");

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
          }}>Complete Hosiery Range</h2>
          <p style={{ color: '#777', fontSize: '16px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            From everyday essentials to fashion-forward styles — men's and kids' hosiery manufactured under one roof.
          </p>
        </div>

        {/* Men's */}
        <div style={{ marginBottom: '4rem', opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '2rem' }}>
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '600', whiteSpace: 'nowrap' }}>Men's Collection</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#252525' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {mens.map((p, i) => (
              <ProductCard key={i} {...p} visible={visible} delay={i * 0.08} />
            ))}
          </div>
        </div>

        {/* Kids' */}
        <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 0.25s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '2rem' }}>
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '600', whiteSpace: 'nowrap' }}>Kids' Collection</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#252525' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {kids.map((p, i) => (
              <ProductCard key={i} {...p} visible={visible} delay={(i + 4) * 0.08} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: '5rem', opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.6s' }}>
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
