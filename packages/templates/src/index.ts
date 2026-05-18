export const templates = {
  'aws-basic': `
version: "1.0"
provider: aws
nodes:
  - id: web-server
    name: Web Server
    type: AWS::EC2::Instance
    properties:
      instanceType: t3.medium
  - id: database
    name: User DB
    type: AWS::RDS::DBInstance
    properties:
      engine: postgres
edges:
  - from: web-server
    to: database
    label: SQL Connection
`,
  'azure-basic': `
version: "1.0"
provider: azure
nodes:
  - id: app-service
    name: App Service
    type: Microsoft.Web/sites
  - id: sql-server
    name: SQL Database
    type: Microsoft.Sql/servers
edges:
  - from: app-service
    to: sql-server
`,
};

export type TemplateName = keyof typeof templates;

export function getTemplate(name: TemplateName): string {
  const tpl = templates[name];
  if (!tpl) {
    throw new Error(
      `Unknown template: ${name}. Known: ${listTemplates().join(', ')}`
    );
  }
  return tpl;
}

export function listTemplates(): string[] {
  return Object.keys(templates);
}
