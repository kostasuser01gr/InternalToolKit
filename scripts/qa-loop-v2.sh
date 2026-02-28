#!/bin/bash
set -e

# Configuration
RUNS=${QA_LOOP_RUNS:-1}
FAILED=0

echo "=== STARTING QA LOOP V2 (Runs: $RUNS) ==="

for ((i=1; i<=RUNS; i++)); do
  echo ""
  echo "--- RUN $i OF $RUNS ---"
  
  echo "Step 1: Lint"
  pnpm -w lint
  
  echo "Step 2: Typecheck"
  pnpm -w typecheck
  
  echo "Step 3: Unit Tests"
  pnpm -w test
  
  echo "Step 4: Build"
  pnpm --filter @internal-toolkit/web build
  
  echo "Step 5: API Contracts V2"
  pnpm -C apps/web test:api:v2
  
  echo "Step 6: E2E Smoke + Modules"
  pnpm -C apps/web test:e2e
  
  echo "Step 7: Truth Scanner V2"
  pnpm -C apps/web test:full-scan:v2
  
  echo "Step 8: A11y"
  pnpm -C apps/web test:a11y
  
  echo "Step 9: LHCI"
  pnpm -C apps/web lhci
  
  echo "✅ RUN $i PASSED"
done

echo ""
echo "🎉 ALL GREEN - QA Loop V2 completed successfully!"
exit 0
