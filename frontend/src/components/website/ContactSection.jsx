import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const INFO = [
  { Icon: MapPin, label: 'Address',        value: 'Tirupur, Tamil Nadu — 641 XXX', sub: 'India'                            },
  { Icon: Phone,  label: 'Phone',          value: '+91 70100 15644',               sub: 'Mon – Sat, 9 AM – 6 PM'          },
  { Icon: Mail,   label: 'Email',          value: 'arianknitfab@gmail.com',        sub: 'We reply within 24 hours'         },
  { Icon: Clock,  label: 'Business Hours', value: 'Mon – Sat: 9:00 AM – 6:00 PM', sub: 'Sunday: Closed'                   },
];

const FIELD = ({ label, required, children }) => (
  <div>
    <label style={{ display: 'block', color: '#777', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
      {label}{required && ' *'}
    </label>
    {children}
  </div>
);

const inputCss = {
  width: '100%', backgroundColor: '#111', border: '1px solid #2A2A2A',
  borderRadius: '8px', padding: '12px 16px', color: '#fff',
  fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

export default function ContactSection() {
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1400));
    setSubmitting(false);
    setDone(true);
    toast.success("Message sent! We'll get back to you shortly.");
  };

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
            <span style={{ color: '#C9A84C', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>Contact Us</span>
            <div style={{ width: '40px', height: '1px', backgroundColor: '#C9A84C' }} />
          </div>
          <h2 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700', color: '#fff', marginBottom: '1rem',
          }}>Get In Touch</h2>
          <p style={{ color: '#777', fontSize: '16px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
            Whether you're a retailer, distributor, or sourcing quality hosiery — we'd love to hear from you.
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '4rem', alignItems: 'start',
        }}>

          {/* Info column */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-30px)',
            transition: 'all 0.85s ease-out 0.1s',
          }}>
            <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.6rem', color: '#fff', marginBottom: '2rem', fontWeight: '600' }}>
              Arian Knit Fab
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
              {INFO.map(({ Icon, label, value, sub }, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '44px', height: '44px', minWidth: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={17} color="#C9A84C" />
                  </div>
                  <div>
                    <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>{value}</div>
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Brand pills */}
            <div style={{
              marginTop: '3rem', padding: '1.5rem',
              backgroundColor: '#1A1A1A',
              border: '1px solid #252525', borderRadius: '12px',
            }}>
              <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>Our Brands</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {['Xperiment', 'United Heart'].map((b, i) => (
                  <span key={i} style={{
                    backgroundColor: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.28)',
                    color: '#C9A84C', padding: '7px 18px',
                    borderRadius: '100px', fontSize: '13px', fontWeight: '500',
                  }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Form column */}
          <div style={{
            backgroundColor: '#1A1A1A',
            border: '1px solid #252525',
            borderRadius: '18px', padding: '2.75rem',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(30px)',
            transition: 'all 0.85s ease-out 0.2s',
          }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <CheckCircle size={60} color="#C9A84C" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
                <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#fff', fontSize: '1.6rem', marginBottom: '0.75rem' }}>Message Sent!</h3>
                <p style={{ color: '#777', fontSize: '14px', lineHeight: 1.7 }}>
                  Thank you for reaching out.<br />Our team will contact you within 24 hours.
                </p>
                <button onClick={() => { setDone(false); setForm({ name: '', company: '', phone: '', email: '', message: '' }); }} style={{
                  marginTop: '2rem', color: '#C9A84C', background: 'none',
                  border: '1px solid #C9A84C', padding: '10px 24px',
                  borderRadius: '7px', cursor: 'pointer', fontSize: '14px',
                }}>Send Another</button>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#fff', fontSize: '1.4rem', fontWeight: '600', marginBottom: '2rem' }}>
                  Send Us a Message
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <FIELD label="Full Name" required>
                    <input type="text" name="name" value={form.name} onChange={onChange} required placeholder="Your name" style={inputCss}
                      onFocus={e => e.target.style.borderColor = '#C9A84C'}
                      onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
                  </FIELD>
                  <FIELD label="Company">
                    <input type="text" name="company" value={form.company} onChange={onChange} placeholder="Company / brand" style={inputCss}
                      onFocus={e => e.target.style.borderColor = '#C9A84C'}
                      onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
                  </FIELD>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <FIELD label="Phone" required>
                    <input type="tel" name="phone" value={form.phone} onChange={onChange} required placeholder="+91 70100 15644" style={inputCss}
                      onFocus={e => e.target.style.borderColor = '#C9A84C'}
                      onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
                  </FIELD>
                  <FIELD label="Email">
                    <input type="email" name="email" value={form.email} onChange={onChange} placeholder="your@email.com" style={inputCss}
                      onFocus={e => e.target.style.borderColor = '#C9A84C'}
                      onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
                  </FIELD>
                </div>

                <div style={{ marginBottom: '1.75rem' }}>
                  <FIELD label="Message" required>
                    <textarea name="message" value={form.message} onChange={onChange} required rows={5}
                      placeholder="Tell us about your requirements — product categories, quantities, and any specific needs..."
                      style={{ ...inputCss, resize: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#C9A84C'}
                      onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
                  </FIELD>
                </div>

                <button type="submit" disabled={submitting} style={{
                  width: '100%',
                  backgroundColor: submitting ? '#A68830' : '#C9A84C',
                  color: '#0A0A0A', border: 'none',
                  padding: '16px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: '700', letterSpacing: '0.4px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'background-color 0.2s',
                }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#E8C96A'; }}
                  onMouseLeave={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#C9A84C'; }}
                >
                  {submitting ? 'Sending…' : <><Send size={15} /> Send Message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
