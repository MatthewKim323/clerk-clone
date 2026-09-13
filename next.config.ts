import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  agentRules: false,
  outputFileTracingIncludes: { '/*': ['./content/routes/**/*.json', './components/sections/markup/**/*.json'] },
};
export default config;
