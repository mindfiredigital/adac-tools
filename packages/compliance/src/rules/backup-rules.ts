import { ComplianceRule } from '../types';

export const requireBackupRule: ComplianceRule = {
  id: 'bck-01',
  frameworks: ['pci-dss', 'soc2', 'hipaa', 'iso27001'],
  name: 'Require Backup Strategy',
  description: 'Stateful services must have automated backups enabled.',
  severity: 'high',
  evaluate(service) {
    if (['rds', 'dynamodb', 'cloud-sql', 'cloudsql', 'cloud-spanner', 'firestore', 'bigtable'].includes(service.service)) {
      const config = (service.config || service.configuration) as Record<
        string,
        unknown
      >;
      const retention = config?.backupRetentionPeriod ?? config?.backup_retention_days;
      const enabled = config?.backup_enabled ?? (retention !== undefined && (retention as number) > 0);

      if (!enabled || (retention !== undefined && (retention as number) === 0)) {
        return {
          id: 'bck-01',
          resourceId: service.id,
          framework: '',
          severity: 'high',
          message: `Backup retention is not enabled for database ${service.name || service.id}.`,
          remediation: {
            id: 'rem-bck-01',
            description:
              'Configure automated backups with a non-zero retention period.',
            actionableSteps: [
              `Set 'backupRetentionPeriod' > 0 for ${service.id}.`,
            ],
            references: [],
          },
        };
      }
    }
    return null;
  },
};
