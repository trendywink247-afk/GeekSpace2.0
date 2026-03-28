// ============================================================
// Website Template Renderer
//
// Server-side HTML/CSS generation from structured params.
// LLM only needs to output ~200 tokens of JSON; the server
// renders the full site. Avoids token-limit failures on free
// models when generating websites from Telegram.
// ============================================================

export interface WebsiteParams {
  template?: 'portfolio' | 'landing' | 'blog' | 'business';
  title?: string;
  name?: string;
  theme?: 'dark' | 'light' | 'purple' | 'blue' | 'gradient';
  profession?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  email?: string;
  tagline?: string;
  primaryColor?: string;
  // For landing / business
  productName?: string;
  description?: string;
  features?: string[];
  cta?: string;
}

// -- Colour themes --

function getThemeColors(theme = 'dark') {
  const themes: Record<string, { bg: string; surface: string; text: string; accent: string; muted: string }> = {
    dark:     { bg: '#0a0a0f', surface: '#13131a', text: '#e2e8f0', accent: '#7c3aed', muted: '#6b7280' },
    light:    { bg: '#f8fafc', surface: '#ffffff', text: '#1e293b', accent: '#4f46e5', muted: '#64748b' },
    purple:   { bg: '#0d0d1a', surface: '#13132a', text: '#e2e8f0', accent: '#a855f7', muted: '#7c3aed' },
    blue:     { bg: '#0a0f1e', surface: '#0f1729', text: '#e2e8f0', accent: '#3b82f6', muted: '#1d4ed8' },
    gradient: { bg: '#0a0a0f', surface: '#13131a', text: '#e2e8f0', accent: '#ec4899', muted: '#8b5cf6' },
  };
  return themes[theme] || themes.dark;
}

// -- Portfolio template --

function renderPortfolio(p: WebsiteParams): { html: string; css: string; js: string } {
  const c = getThemeColors(p.theme);
  const name = p.name || 'Developer';
  const _title = p.title || `${name} — Portfolio`;
  const profession = p.profession || 'Software Developer';
  const location = p.location || '';
  const bio = p.bio || `Passionate ${profession.toLowerCase()} building impactful products.`;
  const email = p.email || '';
  const skills = p.skills?.length ? p.skills : ['JavaScript', 'TypeScript', 'React', 'Node.js'];
  const isGradient = p.theme === 'gradient';

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: ${c.bg}; --surface: ${c.surface}; --text: ${c.text};
      --accent: ${c.accent}; --muted: ${c.muted};
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    nav {
      position: fixed; top: 0; width: 100%; background: rgba(${hexToRgb(c.bg)}, 0.85);
      backdrop-filter: blur(12px); padding: 1rem 2rem; display: flex;
      justify-content: space-between; align-items: center; z-index: 100;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .logo { font-weight: 700; font-size: 1.2rem; color: var(--accent); letter-spacing: -0.5px; }
    nav ul { list-style: none; display: flex; gap: 2rem; }
    nav ul a { color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
    nav ul a:hover { color: var(--text); }
    section { padding: 5rem 2rem; max-width: 1000px; margin: 0 auto; }
    .hero { min-height: 100vh; display: flex; align-items: center; padding-top: 80px; }
    .hero-inner { max-width: 700px; }
    .hero-tag { display: inline-block; background: rgba(${hexToRgb(c.accent)}, 0.12); color: var(--accent);
      padding: 0.3rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 1.5rem; }
    h1 { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 800; line-height: 1.1;
      letter-spacing: -2px; margin-bottom: 1.2rem; }
    ${isGradient ? `h1 span { background: linear-gradient(135deg, ${c.accent}, ${c.muted}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }` : `h1 span { color: var(--accent); }`}
    .hero-bio { font-size: 1.1rem; color: var(--muted); max-width: 500px; margin-bottom: 2rem; line-height: 1.8; }
    .hero-loc { font-size: 0.85rem; color: var(--muted); margin-bottom: 2.5rem; }
    .cta-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .btn { display: inline-block; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 600;
      font-size: 0.9rem; text-decoration: none; transition: all 0.2s; cursor: pointer; border: none; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn-outline { background: transparent; color: var(--text); border: 1.5px solid rgba(255,255,255,0.15); }
    .btn-outline:hover { border-color: var(--accent); color: var(--accent); }
    h2 { font-size: 2rem; font-weight: 700; letter-spacing: -1px; margin-bottom: 2.5rem; }
    h2 em { color: var(--accent); font-style: normal; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .skill-tag { background: var(--surface); border: 1px solid rgba(255,255,255,0.08);
      padding: 0.5rem 1.25rem; border-radius: 100px; font-size: 0.85rem; font-weight: 500;
      color: var(--text); transition: border-color 0.2s; }
    .skill-tag:hover { border-color: var(--accent); }
    .about-text { font-size: 1.05rem; color: var(--muted); line-height: 1.9; max-width: 600px; }
    .contact-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 3rem; text-align: center; }
    .contact-card p { color: var(--muted); margin-bottom: 1.5rem; }
    .email-link { color: var(--accent); text-decoration: none; font-size: 1.1rem; font-weight: 500; }
    .email-link:hover { text-decoration: underline; }
    footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem;
      border-top: 1px solid rgba(255,255,255,0.06); }
    @media (max-width: 600px) {
      nav ul { display: none; }
      h1 { font-size: 2.2rem; }
    }
  `;

  const html = `
    <nav>
      <div class="logo">${name}</div>
      <ul>
        <li><a href="#about">About</a></li>
        <li><a href="#skills">Skills</a></li>
        ${email ? `<li><a href="#contact">Contact</a></li>` : ''}
      </ul>
    </nav>

    <section class="hero" id="hero">
      <div class="hero-inner">
        <div class="hero-tag">${profession}</div>
        <h1>Hi, I'm <span>${name}</span></h1>
        <p class="hero-bio">${bio}</p>
        ${location ? `<p class="hero-loc">📍 ${location}</p>` : ''}
        <div class="cta-row">
          ${email ? `<a href="mailto:${email}" class="btn btn-primary">Get in Touch</a>` : ''}
          <a href="#skills" class="btn btn-outline">View My Skills</a>
        </div>
      </div>
    </section>

    <section id="about">
      <h2>About <em>Me</em></h2>
      <p class="about-text">${bio} I love crafting clean, performant, and user-friendly experiences.</p>
    </section>

    <section id="skills">
      <h2>My <em>Skills</em></h2>
      <div class="skills-grid">
        ${skills.map(s => `<div class="skill-tag">${s}</div>`).join('')}
      </div>
    </section>

    ${email ? `
    <section id="contact">
      <h2>Get in <em>Touch</em></h2>
      <div class="contact-card">
        <p>I'm open to new opportunities and collaborations.</p>
        <a href="mailto:${email}" class="email-link">${email}</a>
      </div>
    </section>` : ''}

    <footer>
      <p>Built with Agentin &mdash; &copy; ${new Date().getFullYear()} ${name}</p>
    </footer>
  `;

  const js = `
    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
      });
    });
    // Fade-in on scroll
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = 1; e.target.style.transform = 'translateY(0)'; } });
    }, { threshold: 0.1 });
    document.querySelectorAll('section').forEach(s => {
      s.style.opacity = 0; s.style.transform = 'translateY(20px)'; s.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(s);
    });
  `;

  return { html, css, js };
}

// -- Landing page template --

function renderLanding(p: WebsiteParams): { html: string; css: string; js: string } {
  const c = getThemeColors(p.theme);
  const productName = p.productName || p.name || 'Product';
  const tagline = p.tagline || 'The future is here.';
  const description = p.description || 'A powerful product built for the modern world.';
  const features = p.features?.length ? p.features : ['Fast', 'Reliable', 'Beautiful'];
  const cta = p.cta || 'Get Started';
  const email = p.email || '';

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: ${c.bg}; color: ${c.text}; }
    nav { padding: 1.5rem 3rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-weight: 800; font-size: 1.3rem; color: ${c.accent}; }
    .hero { min-height: 90vh; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 2rem; }
    .hero-inner { max-width: 800px; }
    .badge { display: inline-block; background: rgba(${hexToRgb(c.accent)}, 0.15); color: ${c.accent};
      padding: 0.4rem 1.2rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2rem; }
    h1 { font-size: clamp(3rem, 8vw, 5.5rem); font-weight: 900; line-height: 1; letter-spacing: -3px;
      margin-bottom: 1.5rem; }
    h1 .accent { color: ${c.accent}; }
    .sub { font-size: 1.2rem; color: ${c.muted}; max-width: 500px; margin: 0 auto 2.5rem; line-height: 1.7; }
    .btn { display: inline-block; padding: 1rem 2.5rem; background: ${c.accent}; color: #fff;
      border-radius: 10px; font-weight: 700; font-size: 1rem; text-decoration: none; transition: all 0.2s; }
    .btn:hover { opacity: 0.85; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(${hexToRgb(c.accent)}, 0.3); }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem; max-width: 900px; margin: 5rem auto; padding: 0 2rem; }
    .feature { background: ${c.surface}; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 2rem; transition: border-color 0.2s; }
    .feature:hover { border-color: ${c.accent}; }
    .feature h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
    .feature p { color: ${c.muted}; font-size: 0.9rem; line-height: 1.6; }
    footer { text-align: center; padding: 3rem 2rem; color: ${c.muted}; font-size: 0.85rem;
      border-top: 1px solid rgba(255,255,255,0.06); }
    ${email ? `.email { color: ${c.accent}; text-decoration: none; }` : ''}
  `;

  const featureIcons = ['⚡', '🔒', '✨', '🚀', '🎯', '💎'];
  const html = `
    <nav><div class="logo">${productName}</div></nav>
    <div class="hero">
      <div class="hero-inner">
        <div class="badge">Introducing ${productName}</div>
        <h1>${tagline.split(' ').map((w, i) => i === 0 ? `<span class="accent">${w}</span>` : w).join(' ')}</h1>
        <p class="sub">${description}</p>
        <a href="${email ? `mailto:${email}` : '#'}" class="btn">${cta}</a>
      </div>
    </div>
    <div class="features">
      ${features.map((f, i) => `
        <div class="feature">
          <div style="font-size:1.8rem;margin-bottom:0.75rem">${featureIcons[i % featureIcons.length]}</div>
          <h3>${f}</h3>
          <p>Built to be ${f.toLowerCase()} from the ground up.</p>
        </div>`).join('')}
    </div>
    <footer>
      ${email ? `<p>Contact: <a href="mailto:${email}" class="email">${email}</a></p>` : ''}
      <p style="margin-top:0.5rem">&copy; ${new Date().getFullYear()} ${productName}. Built with Agentin.</p>
    </footer>
  `;

  return { html, css, js: '' };
}

// -- Business template --

function renderBusiness(p: WebsiteParams): { html: string; css: string; js: string } {
  const c = getThemeColors(p.theme || 'light');
  const name = p.name || 'Business';
  const tagline = p.tagline || 'Professional services you can trust.';
  const description = p.description || 'Delivering excellence since day one.';
  const features = p.features?.length ? p.features : ['Quality Work', 'Fast Delivery', '24/7 Support'];
  const email = p.email || '';

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: ${c.bg}; color: ${c.text}; }
    nav { padding: 1.2rem 3rem; background: ${c.surface}; display: flex; justify-content: space-between;
      align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { font-weight: 800; font-size: 1.3rem; color: ${c.accent}; }
    .hero { padding: 6rem 3rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: clamp(2.5rem, 5vw, 3.5rem); font-weight: 800; letter-spacing: -1.5px;
      line-height: 1.15; margin-bottom: 1.5rem; }
    h1 span { color: ${c.accent}; }
    .sub { font-size: 1.15rem; color: ${c.muted}; max-width: 550px; margin-bottom: 2.5rem; line-height: 1.8; }
    .btn { display: inline-block; padding: 0.85rem 2rem; background: ${c.accent}; color: #fff;
      border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .btn:hover { opacity: 0.88; }
    .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem; max-width: 900px; margin: 0 auto; padding: 4rem 3rem; background: ${c.surface}; }
    .service { padding: 1.5rem; border-radius: 10px; border: 1px solid rgba(0,0,0,0.08); }
    .service h3 { font-weight: 700; margin-bottom: 0.5rem; color: ${c.accent}; }
    .service p { color: ${c.muted}; font-size: 0.9rem; line-height: 1.6; }
    footer { background: ${c.text === '#1e293b' ? '#1e293b' : c.bg}; color: ${c.text === '#1e293b' ? '#94a3b8' : c.muted};
      text-align: center; padding: 2.5rem; font-size: 0.85rem; }
  `;

  const html = `
    <nav><div class="logo">${name}</div></nav>
    <div class="hero">
      <h1>We deliver <span>${tagline.split(' ')[0]}</span> results.</h1>
      <p class="sub">${description}</p>
      ${email ? `<a href="mailto:${email}" class="btn">Contact Us</a>` : ''}
    </div>
    <div class="services">
      ${features.map(f => `<div class="service"><h3>${f}</h3><p>Our ${f.toLowerCase()} is unmatched in the industry.</p></div>`).join('')}
    </div>
    <footer>
      ${email ? `<p style="margin-bottom:0.5rem">Email: ${email}</p>` : ''}
      <p>&copy; ${new Date().getFullYear()} ${name}. All rights reserved.</p>
    </footer>
  `;

  return { html, css, js: '' };
}

// -- Blog template --

function renderBlog(p: WebsiteParams): { html: string; css: string; js: string } {
  const c = getThemeColors(p.theme);
  const name = p.name || 'Blog';
  const tagline = p.tagline || 'Thoughts on technology, life, and everything in between.';
  const email = p.email || '';

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: ${c.bg}; color: ${c.text}; }
    nav { padding: 1.5rem 3rem; display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo { font-weight: 700; font-size: 1.2rem; color: ${c.accent}; }
    .hero { padding: 5rem 3rem 3rem; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -1px; margin-bottom: 1rem; }
    .sub { color: ${c.muted}; line-height: 1.8; max-width: 500px; }
    .posts { max-width: 700px; margin: 0 auto; padding: 2rem 3rem 5rem; }
    .post { padding: 2rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .post:last-child { border-bottom: none; }
    .post-tag { display: inline-block; color: ${c.accent}; font-size: 0.75rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; }
    .post h2 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem; cursor: pointer; }
    .post h2:hover { color: ${c.accent}; }
    .post p { color: ${c.muted}; line-height: 1.7; font-size: 0.95rem; }
    .post-date { color: ${c.muted}; font-size: 0.8rem; margin-top: 0.75rem; }
    footer { text-align: center; padding: 2rem; color: ${c.muted}; font-size: 0.85rem;
      border-top: 1px solid rgba(255,255,255,0.06); }
  `;

  const samplePosts = [
    { tag: 'Tech', title: 'Getting Started with Modern Web Development', excerpt: 'An introduction to the tools and frameworks shaping the web in 2024.' },
    { tag: 'Life', title: 'What I Learned Building My First Product', excerpt: 'Lessons from shipping, failing, and iterating on a side project.' },
    { tag: 'Career', title: 'How to Stay Consistent as a Developer', excerpt: 'Systems and habits that help me ship code every single day.' },
  ];

  const html = `
    <nav><div class="logo">${name}</div></nav>
    <div class="hero">
      <h1>${name}</h1>
      <p class="sub">${tagline}</p>
    </div>
    <div class="posts">
      ${samplePosts.map((post, i) => `
        <div class="post">
          <div class="post-tag">${post.tag}</div>
          <h2>${post.title}</h2>
          <p>${post.excerpt}</p>
          <div class="post-date">${new Date(Date.now() - i * 7 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>`).join('')}
    </div>
    <footer>
      ${email ? `<p style="margin-bottom:0.5rem">Written by <a href="mailto:${email}" style="color:${c.accent}">${name}</a></p>` : ''}
      <p>&copy; ${new Date().getFullYear()} ${name}. Built with Agentin.</p>
    </footer>
  `;

  return { html, css, js: '' };
}

// -- Hex to RGB helper --

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// -- Public API --

/**
 * Render a website from structured params.
 * Returns { html, css, js, title } ready to store as an artifact.
 */
export function renderWebsiteTemplate(p: WebsiteParams): { html: string; css: string; js: string; title: string } {
  const template = p.template || 'portfolio';
  let result: { html: string; css: string; js: string };

  switch (template) {
    case 'landing':  result = renderLanding(p); break;
    case 'business': result = renderBusiness(p); break;
    case 'blog':     result = renderBlog(p); break;
    default:         result = renderPortfolio(p);
  }

  const title = p.title || (p.name ? `${p.name} — ${template.charAt(0).toUpperCase() + template.slice(1)}` : `My ${template.charAt(0).toUpperCase() + template.slice(1)}`);
  return { ...result, title };
}
