import './App.css';
import { Toaster } from 'sonner';
import Navbar from './components/website/Navbar';
import HeroSection from './components/website/HeroSection';
import AboutSection from './components/website/AboutSection';
import BrandsSection from './components/website/BrandsSection';
import ProductsSection from './components/website/ProductsSection';
import ContactSection from './components/website/ContactSection';
import Footer from './components/website/Footer';

function App() {
  return (
    <div style={{ backgroundColor: '#0F0F0F', color: '#ffffff', minHeight: '100vh' }}>
      <Navbar />
      <main>
        <section id="home"><HeroSection /></section>
        <section id="about"><AboutSection /></section>
        <section id="brands"><BrandsSection /></section>
        <section id="products"><ProductsSection /></section>
        <section id="contact"><ContactSection /></section>
      </main>
      <Footer />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export default App;
