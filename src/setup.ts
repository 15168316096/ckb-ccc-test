/**
 * Jest setup file
 * This file is executed before each test file
 * 
 * NOTE: The --forceExit flag is used in package.json scripts because:
 * 
 * WHY CONNECTIONS DON'T DISCONNECT:
 * --------------------------------
 * The CKB CCC SDK client does not expose any cleanup methods (disconnect(), close(), 
 * destroy(), etc.) to properly tear down connections. After thorough investigation:
 * 
 * 1. Client class (ClientJsonRpc, ClientPublicTestnet, etc.):
 *    - No disconnect() or close() methods available
 *    - No lifecycle management methods exposed
 * 
 * 2. RequestorJsonRpc (handles JSON-RPC requests):
 *    - No public cleanup methods
 *    - Maintains internal state that cannot be cleared
 * 
 * 3. Transport layer (TransportHttp, TransportWebSocket):
 *    - TransportHttp: Uses AbortController and setTimeout for timeouts
 *      but doesn't expose a method to cancel all pending operations
 *    - TransportWebSocket: Maintains open socket connections without
 *      providing a close() method in the public interface
 *    - These resources remain active, keeping the Node.js event loop alive
 * 
 * IMPACT:
 * -------
 * Without cleanup methods, Jest cannot exit naturally because:
 * - HTTP connection pools remain open
 * - WebSocket connections stay active  
 * - Timers from pending requests continue running
 * - The Node.js event loop detects these and waits indefinitely
 * 
 * SOLUTION:
 * ---------
 * The --forceExit flag forces Jest to exit immediately after tests complete,
 * bypassing the event loop check. This is the standard approach when using
 * third-party libraries that don't provide explicit cleanup methods.
 * 
 * This is a known limitation of the CKB CCC SDK and is not a bug in our tests.
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
  
  // NOTE: We cannot clean up SDK resources here because:
  // - The CKB CCC SDK doesn't provide any cleanup methods
  // - Clients, signers, and transport layers have no disconnect/close APIs
  // - This is why we use --forceExit flag in package.json
  // 
  // If the SDK ever adds cleanup methods in the future, they should be called here:
  // await client.disconnect();  // Not available as of @ckb-ccc/ccc v1.1.25
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
