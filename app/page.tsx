import { Section } from '@/components/sections/Section';
import document from '@/components/sections/markup/document.json';
import { ComponentDemos } from '@/components/ComponentDemos';
import { Navigation } from '@/components/Navigation';
import { PageControls } from '@/components/PageControls';
import { HomeMotion } from '@/components/HomeMotion';
import MarketingMotion from '@/components/MarketingMotion';

export default async function Home({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  const { only } = await searchParams;
  if (only) return <><link rel="stylesheet" href="/site.css" /><Section name={only} /><ComponentDemos /><HomeMotion /></>;
  return <div className={document.shellClass}>
    <link rel="stylesheet" href="/site.css" />
    <Section name="header" />
    <main id="main">{document.sections.map(name => <Section key={name} name={name} />)}</main>
    <Section name="footer" />
    <Section name="overlays" />
    <ComponentDemos />
    <Navigation />
    <PageControls />
    <HomeMotion />
    <MarketingMotion sharedOnly />
  </div>;
}
