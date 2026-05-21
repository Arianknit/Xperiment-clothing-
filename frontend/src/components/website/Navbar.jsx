import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home', id: 'home' },
  { label: 'About', id: 'about' },
  { label: 'Brands', id: 'brands' },
  { label: 'Process', id: 'process' },
  { label: 'Products', id: 'products' },
  { label: 'Contact', id: 'contact' },
];

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (id) => {
    scrollTo(id);
    setMenuOpen(false);
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      backgroundColor: scrolled ? 'rgba(10,10,10,0.96)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(201,168,76,0.18)' : '1px solid transparent',
      transition: 'all 0.35s ease',
    }}>
      <div style={{
        maxWidth: '1280px', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '72px', padding: '0 2rem',
      }}>
        {/* Logo */}
        <button onClick={() => handleNav('home')} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '10px',
            border: '2px solid #C9A84C',
            background: 'rgba(201,168,76,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#C9A84C', fontWeight: '800', fontSize: '15px', letterSpacing: '1px', fontFamily: 'Georgia, serif' }}>AKF</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#fff', fontWeight: '600', fontSize: '15px', letterSpacing: '0.3px', lineHeight: 1.2 }}>Arian Knit Fab</div>
            <div style={{ color: '#C9A84C', fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>Est. 2016</div>
          </div>
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '2rem' }}>
          {NAV_LINKS.map(({ label, id }) => (
            <button key={id} onClick={() => handleNav(id)} style={{
              color: '#ccc', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '14px', letterSpacing: '0.4px', padding: '4px 0',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.target.style.color = '#C9A84C'}
              onMouseLeave={e => e.target.style.color = '#ccc'}
            >{label}</button>
          ))}
          <button onClick={() => handleNav('contact')} style={{
            backgroundColor: '#C9A84C', color: '#0A0A0A',
            border: 'none', padding: '10px 26px', borderRadius: '6px',
            fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
            onMouseEnter={e => e.target.style.backgroundColor = '#E8C96A'}
            onMouseLeave={e => e.target.style.backgroundColor = '#C9A84C'}
          >Get Quote</button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{
          color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
        }}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden" style={{
          backgroundColor: '#0D0D0D',
          borderTop: '1px solid rgba(201,168,76,0.15)',
          padding: '1.5rem 2rem 2rem',
        }}>
          {NAV_LINKS.map(({ label, id }) => (
            <button key={id} onClick={() => handleNav(id)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              color: '#ccc', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '16px',
              padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>{label}</button>
          ))}
          <button onClick={() => handleNav('contact')} style={{
            marginTop: '1.5rem', width: '100%',
            backgroundColor: '#C9A84C', color: '#0A0A0A',
            border: 'none', padding: '14px', borderRadius: '6px',
            fontSize: '14px', fontWeight: '700', cursor: 'pointer',
          }}>Get a Quote</button>
        </div>
      )}
    </nav>
  );
}
