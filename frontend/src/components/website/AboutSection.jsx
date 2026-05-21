import React, { useEffect, useRef, useState } from 'react';
import { Award, MapPin, Calendar, Package, Factory, TrendingUp } from 'lucide-react';

const STATS = [
  { icon: Calendar,   value: '7+',       label: 'Years of Excellence',   sub: 'Established 2018'          },
  { icon: Award,      value: '2',        label: 'Premium Brands',        sub: 'Xperiment & UnitedHart'  },
  { icon: Package,    value: '500+',     label: 'Product Variants',      sub: "Men's & Kids' Range"        },
  { icon: TrendingUp, value: 'Pan-India',label: 'Distribution Network',  sub: 'Tirupur Based'             },
];

export default function AboutSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ backgroundColor: '#111111', padding: '110px 2rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '80px', alignItems: 'center',
        }}>

          {/* Text column */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'all 0.85s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.75rem' }}>
              <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
              <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>About AKF</span>
            </div>

            <h2 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: '700', color: '#fff', lineHeight: 1.18, marginBottom: '1.75rem',
            }}>
              Built on Craft,<br />
              <span style={{ color: '#C9A84C' }}>Driven by Quality</span>
            </h2>

            <p style={{ color: '#a0a0a0', lineHeight: 1.85, marginBottom: '1.2rem', fontSize: '15px' }}>
              Founded in 2018 in Tirupur — the knitwear capital of India — Arian Knit Fab (AKF)
              was established with a singular vision: to deliver premium hosiery products that combine
              superior craftsmanship with accessible pricing.
            </p>
            <p style={{ color: '#a0a0a0', lineHeight: 1.85, marginBottom: '1.2rem', fontSize: '15px' }}>
              Operating from the heart of Tamil Nadu's textile hub, we specialize in manufacturing
              men's and kids' hosiery — t-shirts, shorts, track pants, cord sets, and a complete range
              of knitwear essentials. Our facility ensures consistent quality in every piece we produce.
            </p>
            <p style={{ color: '#a0a0a0', lineHeight: 1.85, fontSize: '15px' }}>
              Over the years, AKF has grown into one of Tirupur's established hosiery manufacturers,
              trusted by retailers and distributors across India for reliable quality, timely delivery,
              and competitive pricing.
            </p>

            {/* Location badge */}
            <div style={{
              marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '1rem 1.5rem',
              backgroundColor: 'rgba(201,168,76,0.06)',
              border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: '10px', width: 'fit-content',
            }}>
              <MapPin size={20} color="#C9A84C" />
              <div>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>Tirupur, Tamil Nadu, India</div>
                <div style={{ color: '#777', fontSize: '12px', marginTop: '2px' }}>The Textile Capital of India</div>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'all 0.85s ease-out 0.2s',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem',
          }}>
            {STATS.map(({ icon: Icon, value, label, sub }, i) => (
              <div key={i} style={{
                backgroundColor: '#1A1A1A',
                border: '1px solid #252525',
                borderRadius: '14px', padding: '2rem',
                transition: 'border-color 0.3s, transform 0.3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Icon size={22} color="#C9A84C" style={{ marginBottom: '1rem' }} />
                <div style={{
                  fontSize: '2.1rem', fontWeight: '800',
                  fontFamily: '"Playfair Display", Georgia, serif',
                  color: '#C9A84C', lineHeight: 1, marginBottom: '0.5rem',
                }}>{value}</div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', marginBottom: '3px' }}>{label}</div>
                <div style={{ color: '#666', fontSize: '12px' }}>{sub}</div>
              </div>
            ))}
          </div>

        </div>

        {/* Manufacturing highlight bar */}
        <div style={{
          marginTop: '80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1px',
          backgroundColor: '#252525',
          border: '1px solid #252525',
          borderRadius: '14px', overflow: 'hidden',
          opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.4s',
        }}>
          {[
            { icon: Factory,    title: 'In-House Manufacturing',  desc: 'Full control over quality at every stage' },
            { icon: Award,      title: 'Quality Assured',         desc: 'Rigorous quality checks before dispatch'  },
            { icon: TrendingUp, title: 'Bulk Orders Welcome',     desc: 'Scalable production for large volumes'     },
            { icon: Package,    title: 'Wide Product Range',      desc: 'Men\'s & kids\' hosiery under one roof'   },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} style={{
              backgroundColor: '#141414',
              padding: '2rem 1.75rem',
              display: 'flex', gap: '14px', alignItems: 'flex-start',
              transition: 'background-color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1C1C1C'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#141414'}
            >
              <Icon size={20} color="#C9A84C" style={{ marginTop: '2px', minWidth: '20px' }} />
              <div>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{title}</div>
                <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
