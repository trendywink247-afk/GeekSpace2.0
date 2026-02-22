import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    <section id="templates" className="relative py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-violet-200">Start with a template</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              8 Ways to Start
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Don\'t stare at a blank screen. Pick a template, fill in the blanks, watch the magic happen.
          </motion.p>
        </div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
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
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * index }}
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
                  className="flex-1 py-2 px-4 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Try It
                </button>
                <button
                  onClick={() => handleCopy(template)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Copy prompt"
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-16"
        >
          <p className="text-slate-400 mb-4">
            Or just start typing. Agentin figures out what you need.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white rounded-full font-medium transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
          >
            Start Creating
          </button>
        </motion.div>
      </div>
    </section>
  );
}
