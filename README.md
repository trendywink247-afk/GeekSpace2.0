# GeekSpace AI Platform v2.0 🚀

A multi-tenant AI platform where every subdomain is a specialized AI assistant with its own personality, connections, and knowledge base.

![GeekSpace Dashboard](https://img.shields.io/badge/Dashboard-Live-7B61FF)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF)

## ✨ Features

### 🎯 Landing Page
- **Hero Section** - Animated neural network visualization
- **Company Constellation** - Browse the network of AI personalities
- **AI Persona** - Showcase customizable voice, tone, avatar, and knowledge
- **Automation Engine** - Highlight triggers, APIs, and workflows
- **Security & Control** - Enterprise-grade security features
- **Contact Section** - Request access form

### 📊 Dashboard (v2.0 Enhancements)

#### Overview Page
- 📈 **Weekly Activity Charts** - Area charts showing messages vs API calls
- 🍩 **Task Status Distribution** - Donut chart for completed/pending/overdue tasks
- 📊 **Hourly Activity** - Bar chart showing peak usage times
- ⚡ **Real-time Stats** - Messages, reminders, API calls, response time with trends
- 🔗 **Connected Services** - Quick view of active integrations
- 🤖 **Agent Status** - Live status indicator with model info

#### Reminders Page
- 📅 **Calendar View** - Full month view with reminder indicators
- 📝 **List View** - Detailed list with categories and filters
- 🏷️ **Categories** - Personal, Work, Health, Other with color coding
- 🔍 **Search & Filter** - Search by text, filter by status
- 🔄 **Recurring Reminders** - Daily, weekly, monthly support

#### Connections Page
- 🔌 **Service Health** - Real-time health bars for each connection
- 📊 **Usage Stats** - Requests today, average health, connected count
- 🌐 **Integrations** - Telegram, Google Calendar, GitHub, Twitter/X, LinkedIn, Location
- 🔒 **Privacy First** - End-to-end encryption indicators

#### Agent Settings Page
- 🎨 **Agent Style** - Minimal, Builder, Operator modes
- 🎭 **Personality** - Voice, tone, creativity, formality sliders
- 📝 **System Prompt** - Custom instructions for agent behavior

#### Settings Page (NEW)
- 👤 **Profile** - Avatar, bio, location, website
- 🔔 **Notifications** - Email, push, digest, security alerts
- 🔐 **Security** - 2FA, API keys, active sessions
- 💳 **Billing** - Plan details, credits, usage

#### Terminal Page
- 💻 **CLI Interface** - Direct API access
- 📜 **Command History** - Arrow key navigation
- 📋 **Quick Commands** - One-click common commands

### 🎨 Portfolio View
- 👤 **Public Profile** - Shareable portfolio page
- 💬 **AI Chat** - Visitors can chat with your agent
- 🔗 **Social Links** - GitHub, Twitter, LinkedIn integration
- 🛠️ **Projects Showcase** - Display your work

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3 + shadcn/ui
- **Charts**: Recharts
- **Icons**: Lucide React
- **Components**: Radix UI primitives

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>

# Navigate to project
cd "Kimi_Agent_AI Platform Design (2)/app"

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 📁 Project Structure

```
src/
├── App.tsx                 # Main app with routing
├── main.tsx               # Entry point
├── index.css              # Global styles
├── components/            # Shared UI components
│   ├── ui/               # shadcn/ui components
│   ├── Navigation.tsx
│   └── NeuralBackground.tsx
├── dashboard/            # Dashboard application
│   ├── DashboardApp.tsx
│   └── pages/
│       ├── OverviewPage.tsx      # Charts & stats
│       ├── ConnectionsPage.tsx   # Integrations
│       ├── AgentSettingsPage.tsx # AI personality
│       ├── RemindersPage.tsx     # Calendar & lists
│       ├── TerminalPage.tsx      # CLI interface
│       └── SettingsPage.tsx      # Account settings
├── landing/              # Landing page
│   └── LandingPage.tsx
├── portfolio/            # Public portfolio
│   └── PortfolioView.tsx
├── sections/             # Landing page sections
│   ├── HeroSection.tsx
│   ├── ConstellationSection.tsx
│   ├── PersonaSection.tsx
│   ├── ActivitySection.tsx
│   ├── EngineSection.tsx
│   ├── SecuritySection.tsx
│   └── ContactSection.tsx
├── hooks/                # Custom React hooks
└── lib/                  # Utilities
    └── utils.ts
```

## 🎨 Design System

### Colors
- **Primary**: `#7B61FF` (Purple)
- **Background**: `#05050A` (Dark)
- **Surface**: `#0B0B10` (Card bg)
- **Success**: `#61FF7B` (Green)
- **Warning**: `#FFD761` (Yellow)
- **Error**: `#FF6161` (Red)
- **Pink**: `#FF61DC`

### Typography
- **Headings**: Space Grotesk
- **Body**: Inter
- **Mono**: IBM Plex Mono

## 📝 Environment Variables

Create a `.env` file:

```env
VITE_API_URL=your_api_url
VITE_WS_URL=your_websocket_url
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Radix UI](https://www.radix-ui.com/) for accessible primitives
- [Lucide](https://lucide.dev/) for icons
- [Recharts](https://recharts.org/) for charts

---

Built with ❤️ by the GeekSpace Team
