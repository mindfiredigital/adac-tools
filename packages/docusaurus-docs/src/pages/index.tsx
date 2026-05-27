import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const ProjectFeatures = [
  {
    title: 'adac-core-schema',
    description:
      'Core JSON Schema & Type Definitions. Implements the core ADAC v0.1 JSON Schema and TypeScript interfaces.',
  },
  {
    title: 'adac-parser & adac-validator',
    description:
      'CLI & Library for Validation. Validate ADAC files against the core schema.',
  },
  {
    title: 'adac-layout-engine',
    description:
      'Core Graph Layout Algorithms. Calculate coordinates of nodes and edges without overlapping.',
  },
  {
    title: 'adac-diagram',
    description:
      'SVG/PNG Renderer. Core diagram generation logic and CLI for ADAC.',
  },
  {
    title: 'adac-cli',
    description:
      'Main Monorepo CLI Orchestrator. The main adac CLI entry point.',
  },
  {
    title: 'adac-cost',
    description:
      'Cloud Cost Estimation. Estimate cloud infrastructure costs based on the ADAC model resources.',
  },
  {
    title: 'adac-compliance',
    description:
      'Compliance Rules Engine. Check architecture against common compliance frameworks (PCI-DSS, HIPAA, SOC2, etc).',
  },
  {
    title: 'adac-doc',
    description:
      'Documentation Generator. Parses the ADAC model and produces comprehensive project documentation in Markdown/HTML.',
  },
  {
    title: 'adac-export-*',
    description:
      'Transpilers that convert the ADAC model into Terraform HCL, AWS CloudFormation, or Kubernetes manifests.',
  },
  {
    title: 'adac-web',
    description:
      'Visual Architecture Editor. SPA allowing users to visually design and edit their architectures.',
  },
  {
    title: 'adac-vscode',
    description:
      'VS Code Extension to enhance the developer experience with syntax highlighting and live previews.',
  },
];

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/cli">
            Read Documentation
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Architecture Diagram as Code (ADAC) - Define, visualize, and manage cloud architectures using YAML"
    >
      <HomepageHeader />
      <main>
        <section style={{ padding: '4rem 0' }}>
          <div className="container">
            <Heading
              as="h2"
              style={{ textAlign: 'center', marginBottom: '2rem' }}
            >
              Project Packages & Features
            </Heading>
            <div className="row">
              {ProjectFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className={clsx('col col--4')}
                  style={{ paddingBottom: '2rem' }}
                >
                  <div className="card shadow--md" style={{ height: '100%' }}>
                    <div className="card__header">
                      <h3>{feature.title}</h3>
                    </div>
                    <div className="card__body">
                      <p>{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
