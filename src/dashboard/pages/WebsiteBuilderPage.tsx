import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, LayoutTemplate } from 'lucide-react';
import { ArtifactsPage } from './ArtifactsPage';
import { TemplateGalleryPage } from './TemplateGalleryPage';

export function WebsiteBuilderPage() {
  const [activeTab, setActiveTab] = useState('projects');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Website Builder</h1>
        <p className="text-sm text-[#6B7280] mt-1">Build, manage, and deploy your web projects</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/10">
          <TabsTrigger value="projects" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2">
            <Code className="w-4 h-4" />
            My Projects
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2">
            <LayoutTemplate className="w-4 h-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6">
          <ArtifactsPage onNavigate={(page) => {
            if (page === 'templates') setActiveTab('templates');
          }} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateGalleryPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
