import type { AdacConfig } from '@mindfiredigital/adac-schema';

export const gcpMicroservices: AdacConfig = {
  version: '0.1',
  metadata: {
    name: 'GCP Microservices',
    created: new Date().toISOString(),
    description:
      'A containerized microservices architecture on GCP using GKE, Cloud SQL, and Pub/Sub.',
  },
  infrastructure: {
    clouds: [
      {
        id: 'cloud-gcp',
        provider: 'gcp',
        region: 'us-central1',
        services: [
          {
            id: 'cloud-lb',
            service: 'cloud-load-balancing',
            type: 'networking',
            name: 'Cloud Load Balancing',
            description: 'Global HTTP(S) Load Balancer',
          },
          {
            id: 'gke-cluster',
            service: 'gke',
            type: 'compute',
            name: 'GKE Cluster',
            description: 'Kubernetes cluster for microservices',
            configuration: {
              node_count: 3,
              machine_type: 'e2-standard-4',
              auto_scaling: true,
            },
            cost: {
              quantity: 3,
              unit: 'nodes',
            },
          },
          {
            id: 'cloud-sql',
            service: 'cloud-sql',
            type: 'database',
            name: 'Cloud SQL',
            description: 'Managed PostgreSQL',
            configuration: {
              database_version: 'POSTGRES_14',
              tier: 'db-custom-2-7680',
              availability_type: 'REGIONAL',
            },
            cost: {
              quantity: 1,
              unit: 'instance',
            },
          },
          {
            id: 'pubsub',
            service: 'pubsub',
            type: 'messaging',
            name: 'Pub/Sub',
            description: 'Event streaming and async messaging',
            cost: {
              quantity: 100,
              unit: 'gb',
            },
          },
          {
            id: 'cloud-storage',
            service: 'cloud-storage',
            type: 'storage',
            name: 'Cloud Storage',
            description: 'Blob storage for application assets',
            cost: {
              quantity: 500,
              unit: 'gb',
            },
          },
        ],
      },
    ],
  },
  connections: [
    {
      id: 'conn-lb-gke',
      from: 'cloud-lb',
      to: 'gke-cluster',
      type: 'load-balancing',
    },
    {
      id: 'conn-gke-sql',
      from: 'gke-cluster',
      to: 'cloud-sql',
      type: 'database',
    },
    {
      id: 'conn-gke-pubsub',
      from: 'gke-cluster',
      to: 'pubsub',
      type: 'messaging',
    },
    {
      id: 'conn-gke-storage',
      from: 'gke-cluster',
      to: 'cloud-storage',
      type: 'storage',
    },
  ],
};
