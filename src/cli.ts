#!/usr/bin/env node

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(`annie-tgs

Commands planned for Phase 1:
  init --plan <plan.json>
  next-wave --workflow <workflow_id>
  dispatch --workflow <workflow_id> --wave <wave_id>
  submit-result --workflow <workflow_id> --result <result.json>
  review-wave --workflow <workflow_id> --wave <wave_id>
  recover --workflow <workflow_id>
  status --workflow <workflow_id>
`);
  process.exit(0);
}

console.error(`Command "${command}" is not implemented yet.`);
process.exit(1);
