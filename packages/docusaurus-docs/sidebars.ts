import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/* Sidebar configuration for ADAC documentation.
   Includes an Introduction, a Core category, and a Diagram section. */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    { type: 'doc', id: 'introduction' },
    {
      type: 'category',
      label: 'Core',
      items: [
        { type: 'doc', id: 'core-schema' },
        { type: 'doc', id: 'parser-validator' },
        { type: 'doc', id: 'layout-engine' },
        { type: 'doc', id: 'cost' },
        { type: 'doc', id: 'compliance' },
      ],
    },
    { type: 'doc', id: 'diagram' },
  ],
};

export default sidebars;
