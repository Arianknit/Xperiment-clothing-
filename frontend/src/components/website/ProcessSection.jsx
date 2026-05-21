import React, { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Raw Cotton Harvesting',
    subtitle: 'The Beginning',
    desc: 'Premium cotton is carefully harvested from the finest farms across India. We source only the best quality cotton — long-staple fibers that form the very foundation of our superior hosiery products.',
    img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=700&auto=format&fit=crop&q=80',
    alt: 'Cotton field harvest',
  },
  {
    num: '02',
    title: 'Ginning & Cleaning',
    subtitle: 'Purifying the Fiber',
    desc: 'The harvested cotton passes through ginning machines that separate seeds and impurities from the raw fiber. Only the purest, cleanest cotton moves forward — setting the quality standard from the very start.',
    img: 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=700&auto=format&fit=crop&q=80',
    alt: 'Cotton fiber cleaning',
  },
  {
    num: '03',
    title: 'Spinning into Yarn',
    subtitle: 'Creating the Thread',
    desc: 'Clean cotton fibers are carded, combed, and drawn into slivers before being spun into yarn. The fineness and twist of the yarn directly determines the softness and strength of the finished fabric.',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&auto=format&fit=crop&q=80',
    alt: 'Yarn spinning spools',
  },
  {
    num: '04',
    title: 'Knitting the Fabric',
    subtitle: 'Weaving the Foundation',
    desc: 'Yarn is fed into high-speed circular knitting machines to form seamless fabric rolls. Our Tirupur facility produces consistent, stretch-comfort fabric — the backbone of every t-shirt, track pant, and coord set we make.',
    img: 'https://images.unsplash.com/photo-1617376694591-7dc36d1e95b2?w=700&auto=format&fit=crop&q=80',
    alt: 'Knitting machine fabric',
  },
  {
    num: '05',
    title: 'Dyeing & Finishing',
    subtitle: 'Adding Life and Colour',
    desc: 'The knitted fabric is dyed using responsible, eco-conscious processes to achieve rich, long-lasting colours. Finishing treatments — softening, shrink-proofing — give our fabrics their signature comfortable feel.',
    img: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=700&auto=format&fit=crop&q=80',
    alt: 'Fabric dyeing process',
  },
  {
    num: '06',
    title: 'Pattern Cutting',
    subtitle: 'Precision in Every Panel',
    desc: 'Skilled cutters lay fabric in precise layers and cut clean garment panels using pattern templates. Accuracy here ensures every garment fits perfectly and fabric wastage is kept to an absolute minimum.',
    img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&auto=format&fit=crop&q=80',
    alt: 'Fabric cutting pattern',
  },
  {
    num: '07',
    title: 'Stitching & Assembly',
    subtitle: 'Craftsmanship at Its Core',
    desc: 'Expert tailors stitch the cut panels on industrial sewing machines. Every seam is reinforced and carefully examined — the precision of this step is what gives an AKF garment its durability and lasting quality.',
    img: 'https://images.unsplash.com/photo-1558618047-3c8c76ca4c0b?w=700&auto=format&fit=crop&q=80',
    alt: 'Garment stitching sewing',
  },
  {
    num: '08',
    title: 'Quality Inspection',
    subtitle: 'Zero Tolerance for Defects',
    desc: 'Every finished garment undergoes rigorous quality checks — stitching consistency, colour accuracy, measurements, and fabric integrity are all verified. Only pieces that meet our strict standards proceed to packaging.',
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&auto=format&fit=crop&q=80',
    alt: 'Quality inspection garments',
  },
  {
    num: '09',
    title: 'Packaging & Dispatch',
    subtitle: 'Ready for the World',
    desc: 'Approved garments are neatly folded, tagged under the Xperiment or UnitedHart brand, and packed for dispatch. Orders are delivered across India to retailers and distributors — on time, every time.',
    img: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=700&auto=format&fit=crop&q=80',
    alt: 'Clothes packaging dispatch',
  },
];

function StepCard({ step, index, visible }) {
  const isEven = index % 2 === 1;
  const delay = `${0.1 + (index % 3) * 0.1}s`;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '4rem',
      alignItems: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(36px)',
      transition: `all 0.85s ease-out ${delay}`,
    }}>
      {/* Text block — swaps order on even steps via CSS order */}
      <div style={{ order: isEven ? 2 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.25rem' }}>
          <span style={{
            fontSize: '3.5rem', fontWeight: '800',
            fontFamily: '"Playfair Display", Georgia, serif',
            color: 'rgba(201,168,76,0.18)', lineHeight: 1,
            userSelect: 'none',
          }}>{step.num}</span>
          <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(201,168,76,0.3)' }} />
          <div>
            <div style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '500', marginBottom: '4px' }}>{step.subtitle}</div>
            <h3 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
              fontWeight: '700', color: '#fff', lineHeight: 1.2,
            }}>{step.title}</h3>
          </div>
        </div>
        <p style={{ color: '#a0a0a0', lineHeight: 1.85, fontSize: '15px', paddingLeft: '0' }}>
          {step.desc}
        </p>
        {/* Gold step pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          marginTop: '1.5rem',
          backgroundColor: 'rgba(201,168,76,0.08)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: '100px', padding: '6px 16px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#C9A84C' }} />
          <span style={{ color: '#C9A84C', fontSize: '12px', letterSpacing: '1px' }}>Step {step.num}</span>
        </div>
      </div>

      {/* Image block */}
      <div style={{ order: isEven ? 1 : 2 }}>
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(201,168,76,0.15)',
          position: 'relative',
          aspectRatio: '4/3',
          backgroundColor: '#1A1A1A',
        }}>
          <img
            src={step.img}
            alt={step.alt}
            loading="lazy"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.6s ease',
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            onError={e => { e.target.style.display = 'none'; }}
          />
          {/* Gold corner accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '40px', height: '40px',
            borderTop: '3px solid #C9A84C',
            borderLeft: '3px solid #C9A84C',
            borderRadius: '16px 0 0 0',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '40px', height: '40px',
            borderBottom: '3px solid #C9A84C',
            borderRight: '3px solid #C9A84C',
            borderRadius: '0 0 16px 0',
          }} />
          {/* Step number overlay */}
          <div style={{
            position: 'absolute', bottom: '1rem', left: '1rem',
            backgroundColor: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '8px', padding: '6px 14px',
          }}>
            <span style={{ color: '#C9A84C', fontSize: '12px', fontWeight: '600', letterSpacing: '1px' }}>{step.num} / 09</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProcessSection() {
  const [visible, setVisible] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(new Set());
  const ref = useRef(null);
  const stepRefs = useRef([]);

  useEffect(() => {
    const headerObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) headerObs.observe(ref.current);

    const stepObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.dataset.idx);
          setVisibleSteps(prev => new Set([...prev, idx]));
        }
      });
    }, { threshold: 0.15 });

    stepRefs.current.forEach(el => { if (el) stepObs.observe(el); });

    return () => { headerObs.disconnect(); stepObs.disconnect(); };
  }, []);

  return (
    <div style={{ backgroundColor: '#0A0A0A', padding: '110px 2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Section header */}
        <div ref={ref} style={{
          textAlign: 'center', marginBottom: '6rem',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '1.75rem' }}>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>How We Make It</span>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
          </div>
          <h2 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700', color: '#fff', marginBottom: '1rem',
          }}>
            From Cotton to Clothing
          </h2>
          <p style={{ color: '#777', fontSize: '16px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Every garment we make goes through nine carefully controlled stages — from raw cotton in the field
            to a finished product on the shelf.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7rem' }}>
          {STEPS.map((step, i) => (
            <div
              key={i}
              data-idx={i}
              ref={el => stepRefs.current[i] = el}
            >
              <StepCard step={step} index={i} visible={visibleSteps.has(i)} />

              {/* Divider between steps (not after last) */}
              {i < STEPS.length - 1 && (
                <div style={{
                  marginTop: '7rem',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#1E1E1E' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.4)' }} />
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#1E1E1E' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom badge */}
        <div style={{
          textAlign: 'center', marginTop: '6rem',
          opacity: visible ? 1 : 0, transition: 'opacity 1s ease-out 0.5s',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#141414',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: '100px', padding: '12px 28px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#C9A84C' }} />
            <span style={{ color: '#aaa', fontSize: '14px' }}>
              Manufactured with pride in <span style={{ color: '#C9A84C', fontWeight: '500' }}>Tirupur, Tamil Nadu</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
