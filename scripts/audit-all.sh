#!/usr/bin/env bash
# ============================================================
# GeekSpace Full System Audit Script
# Runs comprehensive checks and generates timestamped reports
# Usage: ./scripts/audit-all.sh
# ============================================================

set -uo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORTS_DIR="${PROJECT_ROOT}/reports"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
AUDIT_DIR="${REPORTS_DIR}/${TIMESTAMP}"
SUMMARY_FILE="${AUDIT_DIR}/AUDIT_SUMMARY.md"

# Colors for terminal output
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$1"; }
blue() { printf '\033[0;34m%s\033[0m\n' "$1"; }
bold() { printf '\033[1m%s\033[0m\n' "$1"; }

# Track overall results
ERRORS=0
WARNINGS=0

# Helper: run command and capture output (allows failure)
run_and_capture() {
    local name="$1"
    local cmd="$2"
    local output_file="${AUDIT_DIR}/${name}.log"
    local status=0

    echo "Running: ${cmd}" > "$output_file"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$output_file"
    echo "============================================" >> "$output_file"
    echo "" >> "$output_file"

    eval "$cmd" >> "$output_file" 2>&1 || status=$?

    echo "" >> "$output_file"
    echo "============================================" >> "$output_file"
    echo "Exit code: $status" >> "$output_file"
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S')" >> "$output_file"

    return $status
}

# Helper: print section header
section() {
    echo ""
    bold "$1"
    echo "============================================"
}

# Setup directories
setup() {
    mkdir -p "$AUDIT_DIR"
    blue "Audit reports will be saved to: ${AUDIT_DIR}"
    echo ""
}

# Git repository overview
check_git() {
    section "[1/7] Git Repository Overview"

    local output="${AUDIT_DIR}/01_git_status.log"
    {
        echo "=== Git Status ==="
        git -C "$PROJECT_ROOT" status
        echo ""
        echo "=== Current Branch ==="
        git -C "$PROJECT_ROOT" branch --show-current
        echo ""
        echo "=== Last 10 Commits ==="
        git -C "$PROJECT_ROOT" log --oneline -10
        echo ""
        echo "=== Remote Configuration ==="
        git -C "$PROJECT_ROOT" remote -v
        echo ""
        echo "=== Uncommitted Changes (stat) ==="
        git -C "$PROJECT_ROOT" diff --stat
        echo ""
        echo "=== Staged Changes ==="
        git -C "$PROJECT_ROOT" diff --cached --stat
    } > "$output" 2>&1

    # Display summary
    local branch
    branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
    local uncommitted
    uncommitted=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | wc -l)

    green "  Branch: $branch"
    if [ "$uncommitted" -gt 0 ]; then
        yellow "  Warning: $uncommitted uncommitted changes"
        ((WARNINGS++))
    else
        green "  Working directory clean"
    fi
}

# Frontend checks (lint, typecheck, build)
check_frontend() {
    section "[2/7] Frontend Checks (Lint, Typecheck, Build)"

    cd "$PROJECT_ROOT"

    # Lint
    if run_and_capture "02a_frontend_lint" "npm run lint"; then
        green "  Lint: PASSED"
    else
        red "  Lint: FAILED (see 02a_frontend_lint.log)"
        ((ERRORS++))
    fi

    # Typecheck (via build which runs tsc -b)
    if run_and_capture "02b_frontend_typecheck" "npx tsc -b --noEmit"; then
        green "  Typecheck: PASSED"
    else
        red "  Typecheck: FAILED (see 02b_frontend_typecheck.log)"
        ((ERRORS++))
    fi

    # Build
    if run_and_capture "02c_frontend_build" "npm run build"; then
        green "  Build: PASSED"
    else
        red "  Build: FAILED (see 02c_frontend_build.log)"
        ((ERRORS++))
    fi
}

# Backend checks (typecheck, build)
check_backend() {
    section "[3/7] Backend Checks (Typecheck, Build)"

    cd "${PROJECT_ROOT}/server"

    # Typecheck
    if run_and_capture "03a_backend_typecheck" "npx tsc --noEmit"; then
        green "  Typecheck: PASSED"
    else
        red "  Typecheck: FAILED (see 03a_backend_typecheck.log)"
        ((ERRORS++))
    fi

    # Build
    if run_and_capture "03b_backend_build" "npm run build"; then
        green "  Build: PASSED"
    else
        red "  Build: FAILED (see 03b_backend_build.log)"
        ((ERRORS++))
    fi

    cd "$PROJECT_ROOT"
}

# Test execution
check_tests() {
    section "[4/7] Test Execution"

    cd "$PROJECT_ROOT"

    # Check if test scripts exist
    if npm run --silent 2>/dev/null | grep -q "^  test$"; then
        if run_and_capture "04_tests" "npm test"; then
            green "  Tests: PASSED"
        else
            red "  Tests: FAILED (see 04_tests.log)"
            ((ERRORS++))
        fi
    else
        yellow "  No test script found in package.json - skipping"
        echo "No test script configured" > "${AUDIT_DIR}/04_tests.log"
        ((WARNINGS++))
    fi
}

# Docker Compose validation
check_docker() {
    section "[5/7] Docker Compose Validation"

    local compose_file="${PROJECT_ROOT}/docker-compose.yml"

    if [ ! -f "$compose_file" ]; then
        yellow "  docker-compose.yml not found - skipping"
        echo "docker-compose.yml not found" > "${AUDIT_DIR}/05_docker_config.log"
        ((WARNINGS++))
        return
    fi

    # Validate config
    if run_and_capture "05a_docker_config" "docker compose -f ${compose_file} config"; then
        green "  Config validation: PASSED"
    else
        red "  Config validation: FAILED (see 05a_docker_config.log)"
        ((ERRORS++))
    fi

    # Check container status
    {
        echo "=== Docker Container Status ==="
        docker ps --filter "name=geekspace" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No geekspace containers running"
        echo ""
        echo "=== Docker System Info ==="
        docker system df
        echo ""
        echo "=== Docker Networks ==="
        docker network ls | grep -E "geekspace|NETWORK"
    } > "${AUDIT_DIR}/05b_docker_status.log" 2>&1

    green "  Container status captured"
}

# Smoke tests for endpoints
check_endpoints() {
    section "[6/7] Endpoint Smoke Tests"

    local base_url="http://localhost:3001"
    local output="${AUDIT_DIR}/06_endpoint_tests.log"

    echo "Testing endpoints at: $base_url" > "$output"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$output"
    echo "============================================" >> "$output"
    echo "" >> "$output"

    local endpoint_failures=0

    # Test /api/health
    echo "Testing GET /api/health..." >> "$output"
    local health_status
    health_status=$(curl -s -o /dev/null -w '%{http_code}' "${base_url}/api/health" 2>/dev/null || echo "000")
    echo "  Status: $health_status" >> "$output"
    if [ "$health_status" = "200" ]; then
        local health_body
        health_body=$(curl -s "${base_url}/api/health" 2>/dev/null || echo "{}")
        echo "  Response: $health_body" >> "$output"
        green "  /api/health: $health_status"
    else
        red "  /api/health: $health_status (expected 200)"
        ((endpoint_failures++))
    fi

    # Test /api/billing/plans (public)
    echo "" >> "$output"
    echo "Testing GET /api/billing/plans..." >> "$output"
    local plans_status
    plans_status=$(curl -s -o /dev/null -w '%{http_code}' "${base_url}/api/billing/plans" 2>/dev/null || echo "000")
    echo "  Status: $plans_status" >> "$output"
    if [ "$plans_status" = "200" ]; then
        green "  /api/billing/plans: $plans_status"
    else
        red "  /api/billing/plans: $plans_status (expected 200)"
        ((endpoint_failures++))
    fi

    # Test SSE stream endpoint
    echo "" >> "$output"
    echo "Testing GET /api/health/stream..." >> "$output"
    local sse_output
    sse_output=$(curl -s -N --max-time 5 "${base_url}/api/health/stream" 2>/dev/null | head -1 || echo "")
    if echo "$sse_output" | grep -q "data:"; then
        echo "  Response: SSE stream active" >> "$output"
        green "  /api/health/stream: SSE active"
    else
        echo "  Response: No SSE data received" >> "$output"
        red "  /api/health/stream: No SSE data"
        ((endpoint_failures++))
    fi

    # Test dashboard (check if it returns HTML)
    echo "" >> "$output"
    echo "Testing GET / (dashboard)..." >> "$output"
    local dashboard_status
    dashboard_status=$(curl -s -o /dev/null -w '%{http_code}' "${base_url}/" 2>/dev/null || echo "000")
    echo "  Status: $dashboard_status" >> "$output"
    if [ "$dashboard_status" = "200" ] || [ "$dashboard_status" = "304" ] || [ "$dashboard_status" = "301" ] || [ "$dashboard_status" = "302" ]; then
        green "  / (dashboard): $dashboard_status"
    else
        yellow "  / (dashboard): $dashboard_status (may require auth)"
    fi

    # Test Redis
    echo "" >> "$output"
    echo "Testing Redis connectivity..." >> "$output"
    local redis_ping
    redis_ping=$(docker exec geekspace-redis redis-cli ping 2>/dev/null || echo "FAILED")
    echo "  Redis ping: $redis_ping" >> "$output"
    if [ "$redis_ping" = "PONG" ]; then
        green "  Redis: PONG"
    else
        yellow "  Redis: Not responding (container may be down)"
        ((WARNINGS++))
    fi

    echo "" >> "$output"
    echo "============================================" >> "$output"
    echo "Endpoint failures: $endpoint_failures" >> "$output"
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S')" >> "$output"

    if [ "$endpoint_failures" -gt 0 ]; then
        ((ERRORS+=$endpoint_failures))
    fi
}

# System resource check
check_system() {
    section "[7/7] System Resources"

    local output="${AUDIT_DIR}/07_system_resources.log"
    {
        echo "=== Disk Usage ==="
        df -h /
        echo ""
        echo "=== Memory Usage ==="
        free -h
        echo ""
        echo "=== Load Average ==="
        uptime
        echo ""
        echo "=== Node Version ==="
        node --version 2>/dev/null || echo "Node not found"
        echo ""
        echo "=== NPM Version ==="
        npm --version 2>/dev/null || echo "NPM not found"
        echo ""
        echo "=== Docker Version ==="
        docker --version 2>/dev/null || echo "Docker not found"
        echo ""
        echo "=== Running Processes (Node) ==="
        ps aux | grep -E "node|npm" | grep -v grep || echo "No Node processes"
    } > "$output" 2>&1

    green "  System info captured"

    # Check disk space
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        red "  WARNING: Disk usage at ${disk_usage}%"
        ((WARNINGS++))
    else
        green "  Disk usage: ${disk_usage}%"
    fi
}

# Generate final summary report
generate_summary() {
    section "Generating Summary Report"

    cat > "$SUMMARY_FILE" << 'EOF'
# GeekSpace Audit Summary

**Audit Date:** TIMESTAMP_PLACEHOLDER
**Report Location:** REPORT_DIR_PLACEHOLDER

## Quick Stats

| Metric | Value |
|--------|-------|
| Errors | ERROR_COUNT |
| Warnings | WARNING_COUNT |
| Status | OVERALL_STATUS |

## Check Results

### 1. Git Repository
- **Branch:** BRANCH_PLACEHOLDER
- **Uncommitted Changes:** UNC_PLACEHOLDER
- **Last Commit:** COMMIT_PLACEHOLDER
- **Log:** `01_git_status.log`

### 2. Frontend Checks
- **Lint:** LINT_STATUS → `02a_frontend_lint.log`
- **Typecheck:** TYPECHECK_STATUS → `02b_frontend_typecheck.log`
- **Build:** BUILD_STATUS → `02c_frontend_build.log`

### 3. Backend Checks
- **Typecheck:** BACKEND_TYPECHECK_STATUS → `03a_backend_typecheck.log`
- **Build:** BACKEND_BUILD_STATUS → `03b_backend_build.log`

### 4. Tests
- **Status:** TEST_STATUS → `04_tests.log`

### 5. Docker Compose
- **Config Validation:** DOCKER_CONFIG_STATUS → `05a_docker_config.log`
- **Container Status:** `05b_docker_status.log`

### 6. Endpoint Smoke Tests
- **Results:** `06_endpoint_tests.log`
- **/api/health:** HEALTH_STATUS
- **/api/billing/plans:** PLANS_STATUS
- **/api/health/stream:** STREAM_STATUS
- **Redis:** REDIS_STATUS

### 7. System Resources
- **Details:** `07_system_resources.log`

## Full Log Files

All detailed logs are in: `REPORT_DIR_PLACEHOLDER`

```
EOF

    # Add file listing
    ls -la "$AUDIT_DIR" >> "$SUMMARY_FILE"
    echo '```' >> "$SUMMARY_FILE"

    # Replace placeholders
    local branch
    branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
    local uncommitted
    uncommitted=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | wc -l)
    local last_commit
    last_commit=$(git -C "$PROJECT_ROOT" log --oneline -1 2>/dev/null || echo "unknown")

    local lint_status="SKIPPED"
    local typecheck_status="SKIPPED"
    local build_status="SKIPPED"
    local b_typecheck_status="SKIPPED"
    local b_build_status="SKIPPED"
    local test_status="SKIPPED"
    local docker_config_status="SKIPPED"
    local overall_status="✅ PASSED"

    [ -f "${AUDIT_DIR}/02a_frontend_lint.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/02a_frontend_lint.log" && lint_status="✅ PASSED" || lint_status="❌ FAILED"
    }
    [ -f "${AUDIT_DIR}/02b_frontend_typecheck.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/02b_frontend_typecheck.log" && typecheck_status="✅ PASSED" || typecheck_status="❌ FAILED"
    }
    [ -f "${AUDIT_DIR}/02c_frontend_build.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/02c_frontend_build.log" && build_status="✅ PASSED" || build_status="❌ FAILED"
    }
    [ -f "${AUDIT_DIR}/03a_backend_typecheck.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/03a_backend_typecheck.log" && b_typecheck_status="✅ PASSED" || b_typecheck_status="❌ FAILED"
    }
    [ -f "${AUDIT_DIR}/03b_backend_build.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/03b_backend_build.log" && b_build_status="✅ PASSED" || b_build_status="❌ FAILED"
    }
    [ -f "${AUDIT_DIR}/04_tests.log" ] && {
        if grep -q "No test script" "${AUDIT_DIR}/04_tests.log"; then
            test_status="⚠️ SKIPPED"
        else
            grep -q "Exit code: 0" "${AUDIT_DIR}/04_tests.log" && test_status="✅ PASSED" || test_status="❌ FAILED"
        fi
    }
    [ -f "${AUDIT_DIR}/05a_docker_config.log" ] && {
        grep -q "Exit code: 0" "${AUDIT_DIR}/05a_docker_config.log" && docker_config_status="✅ PASSED" || docker_config_status="❌ FAILED"
    }

    # Extract endpoint results from log
    local health_status="UNKNOWN"
    local plans_status="UNKNOWN"
    local stream_status="UNKNOWN"
    local redis_status="UNKNOWN"
    [ -f "${AUDIT_DIR}/06_endpoint_tests.log" ] && {
        health_status=$(grep "Status: [0-9]" "${AUDIT_DIR}/06_endpoint_tests.log" | head -1 | grep -o "[0-9]\{3\}" || echo "UNKNOWN")
        plans_status=$(grep "api/billing/plans" -A1 "${AUDIT_DIR}/06_endpoint_tests.log" | grep "Status:" | grep -o "[0-9]\{3\}" || echo "UNKNOWN")
        grep -q "SSE stream active" "${AUDIT_DIR}/06_endpoint_tests.log" && stream_status="✅ Active" || stream_status="❌ No data"
        grep -q "Redis: PONG" "${AUDIT_DIR}/06_endpoint_tests.log" 2>/dev/null || grep -q "Redis ping: PONG" "${AUDIT_DIR}/06_endpoint_tests.log" && redis_status="✅ PONG" || redis_status="⚠️ Not responding"
    }

    # Determine overall status
    if [ "$ERRORS" -gt 0 ]; then
        overall_status="❌ FAILED ($ERRORS errors)"
    elif [ "$WARNINGS" -gt 0 ]; then
        overall_status="⚠️ PASSED WITH WARNINGS ($WARNINGS warnings)"
    fi

    # Replace all placeholders
    sed -i "s|TIMESTAMP_PLACEHOLDER|$(date '+%Y-%m-%d %H:%M:%S')|g" "$SUMMARY_FILE"
    sed -i "s|REPORT_DIR_PLACEHOLDER|${AUDIT_DIR}|g" "$SUMMARY_FILE"
    sed -i "s|ERROR_COUNT|${ERRORS}|g" "$SUMMARY_FILE"
    sed -i "s|WARNING_COUNT|${WARNINGS}|g" "$SUMMARY_FILE"
    sed -i "s|OVERALL_STATUS|${overall_status}|g" "$SUMMARY_FILE"
    sed -i "s|BRANCH_PLACEHOLDER|${branch}|g" "$SUMMARY_FILE"
    sed -i "s|UNC_PLACEHOLDER|${uncommitted}|g" "$SUMMARY_FILE"
    sed -i "s|COMMIT_PLACEHOLDER|${last_commit}|g" "$SUMMARY_FILE"
    # Replace longer placeholders first to avoid partial matches
    sed -i "s|BACKEND_TYPECHECK_STATUS|${b_typecheck_status}|g" "$SUMMARY_FILE"
    sed -i "s|BACKEND_BUILD_STATUS|${b_build_status}|g" "$SUMMARY_FILE"
    sed -i "s|LINT_STATUS|${lint_status}|g" "$SUMMARY_FILE"
    sed -i "s|TYPECHECK_STATUS|${typecheck_status}|g" "$SUMMARY_FILE"
    sed -i "s|BUILD_STATUS|${build_status}|g" "$SUMMARY_FILE"
    sed -i "s|TEST_STATUS|${test_status}|g" "$SUMMARY_FILE"
    sed -i "s|DOCKER_CONFIG_STATUS|${docker_config_status}|g" "$SUMMARY_FILE"
    sed -i "s|HEALTH_STATUS|${health_status}|g" "$SUMMARY_FILE"
    sed -i "s|PLANS_STATUS|${plans_status}|g" "$SUMMARY_FILE"
    sed -i "s|STREAM_STATUS|${stream_status}|g" "$SUMMARY_FILE"
    sed -i "s|REDIS_STATUS|${redis_status}|g" "$SUMMARY_FILE"

    # Create latest symlink
    ln -sf "${AUDIT_DIR}/AUDIT_SUMMARY.md" "${REPORTS_DIR}/AUDIT_SUMMARY.md"

    green "  Summary report generated: ${SUMMARY_FILE}"
}

# Print final results
print_results() {
    echo ""
    echo "============================================"
    bold "Audit Complete!"
    echo "============================================"
    echo "Reports saved to: ${AUDIT_DIR}"
    echo ""
    if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
        green "✅ All checks passed!"
    elif [ "$ERRORS" -eq 0 ]; then
        yellow "⚠️  Completed with $WARNINGS warning(s)"
    else
        red "❌ Completed with $ERRORS error(s) and $WARNINGS warning(s)"
    fi
    echo ""
    blue "View summary: cat ${SUMMARY_FILE}"
    blue "Latest symlink: ${REPORTS_DIR}/AUDIT_SUMMARY.md"
}

# Main execution
main() {
    bold "============================================"
    bold "  GeekSpace Full System Audit"
    bold "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
    bold "============================================"

    setup
    check_git
    check_frontend
    check_backend
    check_tests
    check_docker
    check_endpoints
    check_system
    generate_summary
    print_results

    # Exit with error count
    exit "$ERRORS"
}

main "$@"
