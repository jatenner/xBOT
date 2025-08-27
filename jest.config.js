/**
 * 🧪 JEST CONFIGURATION - Comprehensive Testing Setup
 * 
 * Addresses the 40% test coverage issue with modern testing configuration
 */

module.exports = {
  // Use TypeScript and modern JS features
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/src/**/__tests__/*.ts'
  ],
  
  // TypeScript configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true
        }
      }
    }]
  },
  
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Focus on core files for coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.config.ts'
  ],
  
  // Coverage thresholds (gradually increase these)
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75
    },
    // Critical files should have higher coverage
    'src/core/autonomousPostingEngine.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/posting/enhancedThreadComposer.ts': {
      branches: 65,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Performance and timeout settings
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: '50%', // Use half available cores
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: true,
  
  // Performance monitoring
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }]
  ],
  
  // Global test environment variables
  globals: {
    'ts-jest': {
      useESM: false
    }
  }
};