const rpcUrl = process.argv[2] ?? "http://127.0.0.1:8114";
const deadline = Date.now() + 60_000;

while (Date.now() < deadline) {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "get_tip_block_number",
        params: [],
      }),
    });
    const payload = (await response.json()) as { result?: unknown };
    if (payload.result !== undefined) {
      process.exit(0);
    }
  } catch {
    // Keep polling until the devnet RPC starts accepting requests.
  }

  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

throw new Error(`CKB RPC did not become ready at ${rpcUrl}`);
