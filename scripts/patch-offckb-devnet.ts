import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const offckbRoot = dirname(require.resolve("@offckb/cli/package.json"));

const replacements: Array<[string, RegExp, string]> = [
  [
    join(offckbRoot, "ckb/devnet/specs/dev.toml"),
    /genesis_epoch_length = \d+/,
    "genesis_epoch_length = 10",
  ],
  [
    join(offckbRoot, "ckb/devnet/ckb.toml"),
    /value = "0x[a-fA-F0-9]+"/,
    'value = "0x3e8"',
  ],
];

for (const [path, pattern, replacement] of replacements) {
  const original = await readFile(path, "utf8");
  const patched = original.replace(pattern, replacement);
  if (patched === original) {
    throw new Error(`failed to patch ${path}`);
  }
  await writeFile(path, patched);
}
