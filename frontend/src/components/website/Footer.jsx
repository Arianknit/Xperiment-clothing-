import React from 'react';
import { MapPin, Phone, Mail, Instagram, Facebook, Linkedin } from 'lucide-react';

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

const NAV = ['home', 'about', 'brands', 'products', 'contact'];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#080808', borderTop: '1px solid #181818' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '80px 2rem 0' }}>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '3rem',
          paddingBottom: '4rem',
          borderBottom: '1px solid #181818',
        }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '10px',
                border: '2px solid #C9A84C', background: 'rgba(201,168,76,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#C9A84C', fontWeight: '800', fontSize: '14px', fontFamily: 'Georgia, serif' }}>AKF</span>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: '600', fontSize: '15px' }}>Arian Knit Fab</div>
                <div style={{ color: '#C9A84C', fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase' }}>Est. 2016</div>
              </div>
            </div>
            <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.85, marginBottom: '1.75rem' }}>
              Tirupur's premier hosiery manufacturer. Crafting quality men's and kids' clothing with pride since 2016.
            </p>
            {/* Social */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                <div key={i} style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  backgroundColor: '#141414', border: '1px solid #222',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#C9A84C'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
                >
                  <Icon size={15} color="#666" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {NAV.map(link => (
                <li key={link}>
                  <button onClick={() => scrollTo(link)} style={{
                    color: '#555', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '14px', padding: 0,
                    textTransform: 'capitalize', transition: 'color 0.2s',
                  }}
                    onMouseEnter={e => e.target.style.color = '#C9A84C'}
                    onMouseLeave={e => e.target.style.color = '#555'}
                  >{link.charAt(0).toUpperCase() + link.slice(1)}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Brands */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Our Brands
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { name: 'Xperiment',    sub: 'Bold & Trendy Hosiery'      },
                { name: 'UnitedHart', sub: 'Classic & Comfortable Basics' },
              ].map(({ name, sub }, i) => (
                <div key={i} style={{ borderLeft: '2px solid #C9A84C', paddingLeft: '1rem' }}>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>{name}</div>
                  <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Contact
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {[
                { Icon: MapPin, text: '13/8 LRG Layout, Rayapuram, Tirupur – 641601' },
                { Icon: Phone,  text: '+91 70100 15644 / +91 96294 15644' },
                { Icon: Mail,   text: 'arianknitfab@gmail.com'     },
              ].map(({ Icon, text }, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Icon size={13} color="#C9A84C" style={{ marginTop: '2px', minWidth: '13px' }} />
                  <span style={{ color: '#555', fontSize: '13px', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.75rem 0', flexWrap: 'wrap', gap: '1rem',
        }}>
          <p style={{ color: '#333', fontSize: '13px', margin: 0 }}>
            © 2025 Arian Knit Fab (AKF). All rights reserved.
          </p>
          <p style={{ color: '#333', fontSize: '13px', margin: 0 }}>
            Manufactured in <span style={{ color: '#C9A84C' }}>Tirupur, Tamil Nadu, India</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
