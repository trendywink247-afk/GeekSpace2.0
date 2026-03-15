import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Code2,
  FileText,
  Lightbulb,
  Rocket,
  Globe,
  Calendar,
  Mail,
  Wrench,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

interface Template {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  prompt: string;
  category: string;
  gradient: string;
}

const templates: Template[] = [
  {
    id: 'build-app',
    icon: <Rocket className="w-6 h-6" />,
    title: 'Build an App',
    description: 'From idea to working prototype in minutes',
    category: 'Create',
    gradient: 'from-rose-500 to-orange-500',
    prompt: 'Build me a [type of app] that [what it does]. Use [technologies if any]. Make it clean and modern with good UX. Include all code in a single file I can run immediately.',
  },
  {
    id: 'website',
    icon: <Globe className="w-6 h-6" />,
    title: 'Launch Website',
    description: 'Landing pages, portfolios, or full sites',
    category: 'Create',
    gradient: 'from-violet-500 to-purple-500',
    prompt: 'Create a [type of website] for [purpose/audience]. I want it to feel [vibe/style]. Include [specific sections]. Make it responsive and give me the complete HTML/CSS/JS.',
  },
  {
    id: 'write-content',
    icon: <FileText className="w-6 h-6" />,
    title: 'Write Content',
    description: 'Blog posts, copy, or documentation',
    category: 'Write',
    gradient: 'from-emerald-500 to-teal-500',
    prompt: 'Write [type of content] about [topic]. Tone: [professional/casual/funny]. Target audience: [who]. Key points to cover: [points]. Keep it around [length].',
  },
  {
    id: 'code-review',
    icon: <Code2 className="w-6 h-6" />,
    title: 'Fix My Code',
    description: 'Debug, optimize, or refactor anything',
    category: 'Code',
    gradient: 'from-blue-500 to-cyan-500',
    prompt: 'Here\'s my code:\n```\n[paste code]\n```\nIt\'s supposed to [expected behavior] but [actual problem]. Can you [fix it / optimize it / explain why it doesn\'t work]?',
  },
  {
    id: 'learn-something',
    icon: <Lightbulb className="w-6 h-6" />,
    title: 'Learn Something',
    description: 'Get explained like you\'re 5 or like a pro',
    category: 'Learn',
    gradient: 'from-amber-500 to-yellow-500',
    prompt: 'Explain [concept/technology] to me like I\'m [level: beginner/intermediate/expert]. Use analogies and examples. Start with the big picture, then dive into details if relevant.',
  },
  {
    id: 'plan-project',
    icon: <Calendar className="w-6 h-6" />,
    title: 'Plan a Project',
    description: 'Break down big goals into steps',
    category: 'Plan',
    gradient: 'from-pink-500 to-rose-500',
    prompt: 'I want to [goal/project]. Help me break this down into actionable steps. Consider [constraints/deadlines/resources]. Give me a timeline and prioritize what to do first.',
  },
  {
    id: 'draft-email',
    icon: <Mail className="w-6 h-6" />,
    title: 'Draft an Email',
    description: 'Professional or personal messages',
    category: 'Write',
    gradient: 'from-indigo-500 to-blue-500',
    prompt: 'Draft an email to [recipient] about [subject]. Tone: [formal/friendly/direct/apologetic]. Key points: [what to say]. Keep it [length: short/concise/detailed].',
  },
  {
    id: 'automation',
    icon: <Wrench className="w-6 h-6" />,
    title: 'Automate It',
    description: 'Scripts, workflows, or tools',
    category: 'Build',
    gradient: 'from-cyan-500 to-sky-500',
    prompt: 'I need to automate [task]. I use [tools/platforms]. It should trigger when [condition] and then [actions]. Give me the script or workflow steps to make this happen.',
  },
];

const categories = ['All', 'Create', 'Write', 'Code', 'Learn', 'Plan', 'Build'];

export function PromptTemplatesSection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const filteredTemplates = activeCategory === 'All'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const handleCopy = async (template: Template) => {
    await navigator.clipboard.writeText(template.prompt);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTryTemplate = (template: Template) => {
    const params = new URLSearchParams({
      template: template.id,
      prompt: template.prompt,
    });
    navigate(`/login?${params.toString()}`);
  };

  return (
    <section id="templates" className="relative py-20 md:py-28 lg:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/5 border border-[#00F0FF]/20 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm text-[#00F0FF]/80">Start with a template</span>
          </motion.div>

          <motion.h2
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            <span className="text-gradient">
              What Will You Build?
            </span>
          </motion.h2>

          <motion.p
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
            className="text-lg text-[#8892A4] max-w-2xl mx-auto"
          >
            Pick a template and start creating. Agentin handles the rest.
          </motion.p>
        </div>

        {/* Category Filter */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              aria-current={activeCategory === category ? 'page' : undefined}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 shadow-lg shadow-[#00F0FF]/10'
                  : 'bg-white/5 text-[#8892A4] hover:bg-white/10 hover:text-[#E8E8F0] border border-transparent'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={prefersReducedMotion ? undefined : { delay: 0.1 * index }}
              className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${template.gradient} mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <div className="text-white">{template.icon}</div>
              </div>

              {/* Category Badge */}
              <span className="absolute top-4 right-4 text-xs font-medium text-slate-500">
                {template.category}
              </span>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2">
                {template.title}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {template.description}
              </p>

              {/* Preview of prompt - scrollable */}
              <div className="bg-black/30 rounded-lg p-3 mb-4 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <p className="text-xs text-slate-500 font-mono whitespace-pre-wrap">
                  {template.prompt}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleTryTemplate(template)}
                  className="flex-1 py-2 px-4 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                >
                  Try It
                </button>
                <button
                  onClick={() => handleCopy(template)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  title="Copy prompt"
                  aria-label="Copy prompt to clipboard"
                >
                  {copiedId === template.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Hover Glow */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${template.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.5 }}
          className="text-center mt-16"
        >
          <p className="text-[#8892A4] mb-4">
            Or just start typing. Agentin figures out what you need.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] hover:from-[#00F0FF]/90 hover:to-[#00D4B0]/90 text-[#06060B] rounded-full font-semibold transition-all duration-200 shadow-lg shadow-[#00F0FF]/20 hover:shadow-[#00F0FF]/30 hover:scale-105"
          >
            Start Creating
          </button>
        </motion.div>
      </div>
    </section>
  );
}
