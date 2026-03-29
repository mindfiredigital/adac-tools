// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const optimize = (config: any) => {
  return {
    ...config,
    metadata: {
      ...config.metadata,
      optimized: true,
    },
  };
};
