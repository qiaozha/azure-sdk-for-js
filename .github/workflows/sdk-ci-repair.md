---
name: SDK CI repair
run-name: SDK CI repair ${{ inputs.job_id }}
on:
  workflow_dispatch:
    inputs:
      job_id:
        description: Original Azure job ID assigned by the trusted Foundry dispatcher
        required: true
        type: string
      expected_head:
        description: Captured PR head SHA
        required: true
        type: string
permissions:
  contents: read
  actions: read
  copilot-requests: write
imports:
  - uses: qiaozha/azure-api-to-sdks/.github/workflows/shared/sdk-ci-repair.md@dff773d330173898eb5bfc9955dfe4509f2fab7b
    with:
      source-ref: "dff773d330173898eb5bfc9955dfe4509f2fab7b"
checkout: false
if: needs.repair_execution.result == 'success'
timeout-minutes: 65
max-turns: 4
concurrency:
  group: sdk-ci-repair-${{ inputs.job_id }}
  cancel-in-progress: false
  job-discriminator: ${{ github.run_id }}
safe-outputs:
  create-issue: false
  report-failure-as-issue: false
  report-failed-jobs: false
  report-incomplete: false
  report-missing-tool: false
  report-missing-data: false
  needs: [repair_execution]
  require-agent-success: true
  noop:
    report-as-issue: false
---

Follow the pinned shared workflow. Execution is candidate-only and requires the
original Azure dispatch; manual arbitrary task text is not authorization.
