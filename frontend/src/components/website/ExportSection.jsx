import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe, Package, ShieldCheck, Clock } from 'lucide-react';

const HIGHLIGHTS = [
  {
    Icon: Globe,
    title: 'International Reach',
    desc: 'Exporting quality hosiery products to markets across the globe from Tirupur — India\'s knitwear export hub.',
  },
  {
    Icon: ShieldCheck,
    title: 'Export-Grade Quality',
    desc: 'Every export batch meets international quality standards with thorough pre-shipment inspection and compliance checks.',
  },
  {
    Icon: Package,
    title: 'Export-Ready Packaging',
    desc: 'Custom export packaging with proper labelling, barcoding, and documentation — ready for international retail shelves.',
  },
  {
    Icon: Clock,
    title: 'On-Time Shipments',
    desc: 'Reliable production scheduling ensures your international orders are packed and dispatched on time, every time.',
  },
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function ExportSection() {
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

        {/* Main export banner */}
        <div style={{
          borderRadius: '20px', overflow: 'hidden',
          position: 'relative',
          marginBottom: '4rem',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.85s ease-out',
          border: '1px solid rgba(201,168,76,0.25)',
        }}>
          {/* Background image */}
          <img
            src="https://images.unsplash.com/photo-1493946740644-2d8a1f1a6aff?w=1400&auto=format&fit=crop&q=80"
            alt="Global export shipping"
            style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block', filter: 'brightness(0.25)' }}
          />

          {/* Content overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center',
            padding: '3rem 4rem',
          }}>
            <div style={{ maxWidth: '640px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
                <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>Global Exports</span>
              </div>

              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: '700', color: '#fff', lineHeight: 1.2, marginBottom: '1.25rem',
              }}>
                Taking Tirupur's Quality<br />
                <span style={{ color: '#C9A84C' }}>To the World</span>
              </h2>

              <p style={{ color: '#b0b0b0', lineHeight: 1.85, fontSize: '15px', marginBottom: '2rem' }}>
                Arian Knit Fab exports premium hosiery products internationally, backed by Tirupur's
                world-class manufacturing infrastructure. From men's t-shirts to kids' coordinate sets —
                we deliver Indian craftsmanship to global markets with full compliance and on-time shipments.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                  Export Enquiry <ArrowRight size={15} />
                </button>

                <button onClick={() => scrollTo('contact')} style={{
                  backgroundColor: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)', padding: '14px 32px',
                  borderRadius: '7px', fontSize: '14px', fontWeight: '500',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff'; }}
                >
                  Contact Us
                </button>
              </div>
            </div>

            {/* Right side globe badge */}
            <div style={{
              marginLeft: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            }}
              className="hidden md:flex"
            >
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                border: '2px solid rgba(201,168,76,0.4)',
                backgroundColor: 'rgba(201,168,76,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Globe size={52} color="#C9A84C" />
              </div>
              <span style={{ color: '#C9A84C', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Exporting Globally</span>
            </div>
          </div>
        </div>

        {/* Export stats bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1px',
          backgroundColor: '#1E1E1E',
          border: '1px solid #1E1E1E',
          borderRadius: '14px', overflow: 'hidden',
          marginBottom: '4rem',
          opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.3s',
        }}>
          {[
            { value: 'Tirupur', label: 'Export Hub'              },
            { value: 'MOQ',     label: 'Flexible Quantities'      },
            { value: '100%',    label: 'QC Before Shipment'       },
            { value: 'FOB/CIF', label: 'Shipping Terms Available' },
          ].map(({ value, label }, i) => (
            <div key={i} style={{
              backgroundColor: '#141414', padding: '1.75rem',
              textAlign: 'center',
              transition: 'background-color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1A1A1A'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#141414'}
            >
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '1.5rem', fontWeight: '700',
                color: '#C9A84C', marginBottom: '6px',
              }}>{value}</div>
              <div style={{ color: '#666', fontSize: '12px', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}>
          {HIGHLIGHTS.map(({ Icon, title, desc }, i) => (
            <div key={i} style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #252525',
              borderRadius: '14px', padding: '2rem',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: `all 0.7s ease-out ${0.1 + i * 0.1}s`,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.38)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
