import { packageTargets } from "./stage-native.mjs";
import { packageTargetVsixes } from "./package-targets.mjs";

try {
  await packageTargetVsixes(packageTargets, { allowMissingRepository: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
