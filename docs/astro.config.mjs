// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Lanekeeper',
			description:
				'Agentic change management for GitHub — triage, lanes, guided walkthroughs, applyable fixes, and post-merge security scans.',
			favicon: '/favicon.svg',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/rmukubvu/lanekeeper' },
			],
			sidebar: [
				{
					label: 'Getting started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quick start', slug: 'getting-started/quickstart' },
						{ label: 'Configuration', slug: 'getting-started/configuration' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Triage & lanes', slug: 'guides/triage-and-lanes' },
						{ label: 'Policy as code', slug: 'guides/policy' },
						{ label: 'Team standards', slug: 'guides/guidelines' },
						{ label: 'Guided walkthroughs', slug: 'guides/walkthroughs' },
						{ label: 'Inline suggestions', slug: 'guides/inline-suggestions' },
						{ label: 'Sentinel post-merge scans', slug: 'guides/sentinel' },
						{ label: 'Dashboard', slug: 'guides/dashboard' },
						{ label: 'Chat notifications', slug: 'guides/chat' },
						{ label: 'Model providers', slug: 'guides/providers' },
						{ label: 'GitHub App (server mode)', slug: 'guides/github-app' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'CLI', slug: 'reference/cli' },
						{ label: 'Architecture & guarantees', slug: 'reference/architecture' },
					],
				},
			],
		}),
	],
});
