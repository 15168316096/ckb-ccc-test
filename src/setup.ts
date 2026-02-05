/**
 * Jest setup file
 * This file is executed before each test file
 * 
 * NOTE: The --forceExit flag is used in package.json scripts because
 * the CKB CCC SDK client does not expose a disconnect() or close() method,
 * leaving internal resources (HTTP connection pools, timers) that prevent
 * Jest from exiting naturally. This is a common pattern when using third-party
 * libraries that don't provide explicit cleanup methods.
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Global test configuration
beforeAll(async () => {
  console.log(`\n🚀 Running tests on network: ${process.env.CKB_NETWORK || "devnet"}`);
});

afterAll(async () => {
  console.log("\n✅ Tests completed");
});

// Extend Jest matchers if needed
expect.extend({
  toBeValidCkbAddress(received: string) {
    const pass = received.startsWith("ckb") || received.startsWith("ckt");
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid CKB address`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid CKB address`,
        pass: false,
      };
    }
  },
});

// Type augmentation for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCkbAddress(): R;
    }
  }
}
