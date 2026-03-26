import { render, screen, fireEvent } from '@testing-library/react';
import { CostCompliancePanel } from './cost-compliance-panel';
import { describe, it, expect, vi } from 'vitest';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  DollarSign: () => <div data-testid="dollar-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  ShieldAlert: () => <div data-testid="shield-alert-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  X: () => <div data-testid="x-icon" />,
  Loader: () => <div data-testid="loader-icon" />,
}));

describe('CostCompliancePanel', () => {
  const mockCostItems = [
    {
      nodeId: 'node-1',
      label: 'EC2 Instance',
      tier: 't3.micro',
      monthlyCost: 10.5,
    },
    {
      nodeId: 'node-2',
      label: 'S3 Bucket',
      tier: 'Standard',
      monthlyCost: 5.0,
    },
  ];

  const mockComplianceResults = {
    byService: {
      'node-1': [
        {
          framework: 'pci-dss',
          isCompliant: false,
          violations: [
            {
              id: 'v1',
              resourceId: 'node-1',
              framework: 'pci-dss',
              severity: 'high' as const,
              message: 'Wildcard IAM policy',
              remediation: {
                id: 'r1',
                description: 'Fix it',
                actionableSteps: ['Step 1'],
                references: [],
              },
            },
          ],
          summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
        },
      ],
      'node-2': [
        {
          framework: 'soc2',
          isCompliant: true,
          violations: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        },
      ],
    },
    results: [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [], // specific violations are in byService
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
      {
        framework: 'soc2',
        isCompliant: true,
        violations: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      },
    ],
    remediationPlan: [
      {
        id: 'rem-1',
        resourceId: 'node-1',
        frameworks: ['pci-dss'],
        steps: ['Fix the policy'],
        severity: 'high',
      },
    ],
  };

  const defaultProps = {
    mode: 'cost' as const,
    provider: 'aws' as const,
    costItems: mockCostItems,
    complianceResults: null,
    isCheckingCompliance: false,
    onRunComplianceCheck: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders cost view correctly', () => {
    render(<CostCompliancePanel {...defaultProps} />);

    expect(screen.getByText('Cost Summary')).toBeInTheDocument();
    expect(screen.getByText('$15.50')).toBeInTheDocument(); // total
    expect(screen.getByText('EC2 Instance')).toBeInTheDocument();
    expect(screen.getByText('S3 Bucket')).toBeInTheDocument();
  });

  it('renders empty cost view when no items', () => {
    render(<CostCompliancePanel {...defaultProps} costItems={[]} />);
    expect(screen.getByText('No costs configured yet.')).toBeInTheDocument();
  });

  it('renders compliance view correctly', () => {
    render(<CostCompliancePanel {...defaultProps} mode="compliance" />);

    expect(screen.getByText('Compliance Check')).toBeInTheDocument();
    expect(screen.getByText('Run Compliance Check')).toBeInTheDocument();
    expect(
      screen.getByText(/Assign compliance frameworks/i)
    ).toBeInTheDocument();
  });

  it('handles running compliance check', () => {
    const onRun = vi.fn();
    render(
      <CostCompliancePanel
        {...defaultProps}
        mode="compliance"
        onRunComplianceCheck={onRun}
      />
    );

    fireEvent.click(screen.getByText('Run Compliance Check'));
    expect(onRun).toHaveBeenCalled();
  });

  it('shows loader when checking compliance', () => {
    render(
      <CostCompliancePanel
        {...defaultProps}
        mode="compliance"
        isCheckingCompliance={true}
      />
    );
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('displays compliance results and handles expansion', () => {
    render(
      <CostCompliancePanel
        {...defaultProps}
        mode="compliance"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complianceResults={mockComplianceResults as any}
      />
    );

    expect(screen.getByText(/1 Violation Found/i)).toBeInTheDocument();
    expect(screen.getByText(/1 High/i)).toBeInTheDocument();

    // Check service list
    expect(screen.getAllByText('node-1').length).toBeGreaterThan(0);
    expect(screen.getByText('node-2')).toBeInTheDocument();

    // Expand node-1 (the first one is in the service list)
    fireEvent.click(screen.getAllByText('node-1')[0]);
    expect(screen.getByText('Wildcard IAM policy')).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();

    // Check remediation plan
    expect(screen.getByText('Remediation Plan')).toBeInTheDocument();
    expect(screen.getByText('Fix the policy')).toBeInTheDocument();
  });
});
