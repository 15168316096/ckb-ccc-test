# Why We Use --forceExit Flag

## Issue Summary

When running Jest tests that use the CKB CCC SDK, Jest hangs after all tests complete and never exits naturally. This happens because the SDK maintains open connections and resources that keep the Node.js event loop alive.

## Root Cause

The CKB CCC SDK **does not provide any cleanup or disconnect methods**. After thorough investigation of the SDK source code and type definitions:

### 1. Client Classes (No Cleanup Methods)
- `Client` (abstract base class)
- `ClientJsonRpc` 
- `ClientPublicTestnet`
- `ClientPublicMainnet`

**Finding**: None of these classes expose `disconnect()`, `close()`, `destroy()`, or any similar cleanup methods.

### 2. RequestorJsonRpc (No Cleanup Methods)
Located in: `@ckb-ccc/core/dist/jsonRpc/requestor.d.ts`

The `RequestorJsonRpc` class handles all JSON-RPC requests but:
- No public cleanup methods
- Maintains internal state (`concurrent`, `pending`, `transport`)
- No way to gracefully shut down

### 3. Transport Layer (Open Resources)

#### TransportHttp
- Uses `AbortController` for cancellation
- Creates `setTimeout` timers for request timeouts
- **Problem**: No method to cancel all pending operations or clean up timers

#### TransportWebSocket  
- Maintains WebSocket connections (`this.socket`, `this.openSocket`)
- Tracks ongoing requests in a Map (`this.ongoing`)
- **Problem**: No public `close()` method to terminate connections

## What Resources Remain Open?

After tests complete, these resources prevent Node.js from exiting:

1. **HTTP Connection Pools**: Keep-alive connections remain open
2. **WebSocket Connections**: Active sockets waiting for messages
3. **Timers**: `setTimeout` callbacks from request timeouts
4. **Event Listeners**: Internal event handlers on connections

## Why Jest Waits

Jest detects these open handles and waits for them to close before exiting. This is normally the correct behavior, but when third-party libraries don't provide cleanup methods, Jest will wait forever.

## Our Solution: --forceExit Flag

The `--forceExit` flag tells Jest to exit immediately after tests complete, without waiting for the event loop to be empty.

```json
{
  "scripts": {
    "test": "jest --forceExit",
    "test:dev": "CKB_NETWORK=devnet jest --forceExit",
    "test:testnet": "CKB_NETWORK=testnet jest --forceExit"
  }
}
```

### Why This Is Safe

- Tests are isolated and complete their assertions before --forceExit runs
- No data corruption risk since we're not writing to persistent storage during cleanup
- Standard practice for testing with third-party libraries that lack cleanup APIs
- Jest documentation explicitly mentions this use case

## Alternative Approaches Considered

### ❌ Manual Cleanup in afterAll()
```typescript
afterAll(async () => {
  // Cannot do this - methods don't exist:
  await client.disconnect();  // ❌ Not available
  await client.close();       // ❌ Not available  
});
```

### ❌ Using --detectOpenHandles
This flag helps debug open handles but doesn't solve the problem:
```bash
$ jest --detectOpenHandles
```
Output shows open timers and connections, but we still can't close them.

### ❌ Shorter Test Timeout
```typescript
jest.setTimeout(5000);  // Doesn't help - connections remain open
```

## Future Improvements

If the CKB CCC SDK adds cleanup methods in future versions, we should:

1. Remove `--forceExit` flags from `package.json`
2. Add cleanup in `src/setup.ts`:
   ```typescript
   afterAll(async () => {
     // Future SDK version might support:
     if (typeof client.disconnect === 'function') {
       await client.disconnect();
     }
   });
   ```
3. Update all test files to track and cleanup their client instances

## Related Information

- **Original Question**: "Please help me check if there's anything wrong with the comments here. Why isn't the connection getting disconnected?"
- **Context**: Question arose from PR #1 review asking about connection cleanup
- **Issue Link**: [GitHub Issue #2](https://github.com/15168316096/ckb-ccc-test/issues/2)

## References

- [Jest CLI Options: --forceExit](https://jestjs.io/docs/cli#--forceexit)
- [Jest Issue: Tests hang with open handles](https://github.com/facebook/jest/issues/7287)
- [CKB CCC SDK Repository](https://github.com/ckb-devrel/ccc)

## SDK Version

This documentation is based on `@ckb-ccc/ccc` version `1.1.25`.

If you're using a newer version, check if cleanup methods have been added by inspecting:
```bash
# Check for disconnect/close methods
grep -r "disconnect\|close" node_modules/@ckb-ccc/core/dist/client/
```
