import { Router } from 'express';

export const directoryRouter = Router();

const profiles = [
  { username: 'alex', name: 'Alex Chen', avatar: 'AC', tagline: 'Full-stack Developer & AI Enthusiast', tags: ['AI Engineer', 'Full-stack', 'Open Source'], location: 'San Francisco, CA', skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AI/ML', 'OpenClaw'], agentEnabled: true },
  { username: 'sarah', name: 'Sarah Kim', avatar: 'SK', tagline: 'Product Designer & Creative Technologist', tags: ['Designer', 'Creative Tech', 'UX'], location: 'New York, NY', skills: ['UI/UX', 'Figma', 'Design Systems', 'React', 'Motion Design'], agentEnabled: true },
  { username: 'marcus', name: 'Marcus Wright', avatar: 'MW', tagline: 'Founder & Startup Advisor', tags: ['Founder', 'Advisor', 'Strategy'], location: 'Austin, TX', skills: ['Strategy', 'Fundraising', 'Product', 'Leadership', 'Growth'], agentEnabled: true },
  { username: 'jordan', name: 'Jordan Lee', avatar: 'JL', tagline: 'ML Engineer & Data Scientist', tags: ['ML', 'Data Science', 'Python'], location: 'Seattle, WA', skills: ['Python', 'PyTorch', 'TensorFlow', 'Data Science', 'NLP'], agentEnabled: true },
  { username: 'taylor', name: 'Taylor Brooks', avatar: 'TB', tagline: 'DevOps & Cloud Architect', tags: ['DevOps', 'Cloud', 'Infrastructure'], location: 'Denver, CO', skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD'], agentEnabled: true },
  { username: 'casey', name: 'Casey Rivera', avatar: 'CR', tagline: 'No-Code Automation Expert', tags: ['No-Code', 'Automation', 'Marketing'], location: 'Miami, FL', skills: ['n8n', 'ManyChat', 'Zapier', 'Marketing', 'Growth'], agentEnabled: true },
  { username: 'morgan', name: 'Morgan Patel', avatar: 'MP', tagline: 'AI Storyteller & Content Creator', tags: ['Content', 'AI Writing', 'Storytelling'], location: 'London, UK', skills: ['Content Strategy', 'AI Writing', 'Video', 'Podcasting'], agentEnabled: false },
  { username: 'riley', name: 'Riley Zhang', avatar: 'RZ', tagline: 'Blockchain & Web3 Developer', tags: ['Web3', 'Blockchain', 'Solidity'], location: 'Singapore', skills: ['Solidity', 'Ethereum', 'React', 'Rust', 'Smart Contracts'], agentEnabled: true },
];

directoryRouter.get('/', (req, res) => {
  const search = (req.query.search as string || '').toLowerCase();
  const tagsFilter = req.query.tags as string[] | undefined;

  let filtered = profiles;

  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.tagline.toLowerCase().includes(search) ||
        p.skills.some((s) => s.toLowerCase().includes(search)) ||
        p.tags.some((t) => t.toLowerCase().includes(search)),
    );
  }

  if (tagsFilter && tagsFilter.length) {
    filtered = filtered.filter((p) =>
      tagsFilter.some((t) => p.tags.some((pt) => pt.toLowerCase().includes(t.toLowerCase()))),
    );
  }

  res.json({ profiles: filtered, total: filtered.length });
});
