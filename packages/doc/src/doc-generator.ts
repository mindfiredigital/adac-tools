import Handlebars from 'handlebars';
import { AdacConfig } from '@mindfiredigital/adac-schema';
import { DocOptions, DocOutput, DocFile } from './types/index.js';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import {
  ArchitectureTemplate,
  ServiceCatalogTemplate,
  ConnectionMatrixTemplate,
  CostReportTemplate,
  ComplianceTemplate,
} from './templates/index.js';

export class DocumentationGenerator {
  private options: DocOptions;

  constructor(options: DocOptions = {}) {
    this.options = {
      format: options.format || 'markdown',
      sections: options.sections || [
        'overview',
        'architecture',
        'services',
        'connections',
      ],
      includeMetadata: options.includeMetadata ?? true,
      includeCost: options.includeCost ?? true,
      includeCompliance: options.includeCompliance ?? true,
      template: options.template,
      outputDir: options.outputDir || './docs',
    };
  }

  async generate(model: AdacConfig): Promise<DocOutput> {
    const files: DocFile[] = [];

    if (
      this.options.sections?.includes('overview') ||
      this.options.sections?.includes('architecture')
    ) {
      files.push(await this.generateOverview(model));
    }
    if (this.options.sections?.includes('services')) {
      files.push(await this.generateServiceCatalog(model));
    }
    if (this.options.sections?.includes('connections')) {
      files.push(await this.generateConnectionMatrix(model));
    }
    if (this.options.includeCost && this.options.sections?.includes('cost')) {
      files.push(await this.generateCostReport(model));
    }
    if (
      this.options.includeCompliance &&
      this.options.sections?.includes('compliance')
    ) {
      files.push(await this.generateComplianceReport(model));
    }

    const metadata = {
      generatedAt: new Date().toISOString(),
      sections: this.options.sections || [],
      totalSize: files.reduce((sum, f) => sum + f.content.length, 0),
    };

    return {
      format: this.options.format!,
      files,
      metadata,
    };
  }

  private async generateOverview(model: AdacConfig): Promise<DocFile> {
    const template = Handlebars.compile(ArchitectureTemplate);
    const content = template({
      metadata: model.metadata,
      clouds: model.infrastructure?.clouds || [],
    });

    return {
      name: 'architecture.md',
      content,
      path: 'architecture.md',
    };
  }

  private async generateServiceCatalog(model: AdacConfig): Promise<DocFile> {
    const template = Handlebars.compile(ServiceCatalogTemplate);
    const services = (model.infrastructure?.clouds || []).flatMap((cloud) =>
      (cloud.services || []).map((service) => ({
        ...service,
        provider: cloud.provider,
      }))
    );
    const content = template({ services });

    return {
      name: 'services.md',
      content,
      path: 'services.md',
    };
  }

  private async generateConnectionMatrix(model: AdacConfig): Promise<DocFile> {
    const template = Handlebars.compile(ConnectionMatrixTemplate);
    const connections = model.connections || [];
    const content = template({ connections });

    return {
      name: 'connections.md',
      content,
      path: 'connections.md',
    };
  }

  private async generateCostReport(model: AdacConfig): Promise<DocFile> {
    const template = Handlebars.compile(CostReportTemplate);
    const content = template({ cost: model.cost });

    return {
      name: 'cost.md',
      content,
      path: 'cost.md',
    };
  }

  private async generateComplianceReport(model: AdacConfig): Promise<DocFile> {
    const template = Handlebars.compile(ComplianceTemplate);

    let complianceResults: { results: unknown[]; remediationPlan: unknown[] } =
      { results: [], remediationPlan: [] };
    try {
      const checker = new ComplianceChecker();
      complianceResults = checker.checkCompliance(model) as {
        results: unknown[];
        remediationPlan: unknown[];
      };
    } catch (e) {
      console.warn('Failed to check compliance', e);
    }

    const content = template({
      results: complianceResults.results,
      remediationPlan: complianceResults.remediationPlan,
    });

    return {
      name: 'compliance.md',
      content,
      path: 'compliance.md',
    };
  }
}
