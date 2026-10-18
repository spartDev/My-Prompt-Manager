<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Audit Output Format Differences

npm and pnpm produce different JSON structures from `audit --json`. This reference documents the key differences for programmatic analysis.

---

## npm (v7+)

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "package-name": {
      "name": "package-name",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1089234,
          "name": "vulnerable-transitive",
          "dependency": "package-name",
          "title": "Prototype Pollution",
          "url": "https://github.com/advisories/GHSA-xxxx",
          "severity": "high",
          "cwe": ["CWE-1321"],
          "range": "<2.0.0"
        }
      ],
      "effects": ["downstream-pkg"],
      "range": "*",
      "nodes": ["node_modules/package-name"],
      "fixAvailable": {
        "name": "direct-dep",
        "version": "3.1.0",
        "isSemVerMajor": false
      }
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 1,
      "moderate": 3,
      "high": 2,
      "critical": 0,
      "total": 6
    }
  }
}
```

### Key fields

| Field | Description |
|-------|-------------|
| `vulnerabilities.<pkg>.severity` | Severity level |
| `vulnerabilities.<pkg>.isDirect` | Whether the vulnerable package is a direct dependency |
| `vulnerabilities.<pkg>.via` | Array of advisories or package names causing the vulnerability |
| `vulnerabilities.<pkg>.fixAvailable` | Suggested fix (if any); `isSemVerMajor` indicates breaking change |
| `metadata.vulnerabilities` | Summary counts by severity |

---

## pnpm

```json
{
  "advisories": {
    "1089234": {
      "id": 1089234,
      "module_name": "vulnerable-transitive",
      "title": "Prototype Pollution",
      "severity": "high",
      "url": "https://github.com/advisories/GHSA-xxxx",
      "cves": ["CVE-2023-12345"],
      "vulnerable_versions": "<2.0.0",
      "patched_versions": ">=2.0.0",
      "findings": [
        {
          "version": "1.5.0",
          "paths": [
            "direct-dep>intermediate>vulnerable-transitive"
          ]
        }
      ]
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 1,
      "moderate": 3,
      "high": 2,
      "critical": 0
    },
    "totalDependencies": 412
  }
}
```

### Key fields

| Field | Description |
|-------|-------------|
| `advisories.<id>.severity` | Severity level |
| `advisories.<id>.module_name` | Name of the vulnerable package |
| `advisories.<id>.findings[].paths` | Dependency chains showing how the project reaches the vulnerable package |
| `advisories.<id>.patched_versions` | Version range that fixes the vulnerability |
| `metadata.vulnerabilities` | Summary counts by severity |

---

## Mapping Between Formats

| Concept | npm field | pnpm field |
|---------|-----------|------------|
| Advisory ID | `vulnerabilities.<pkg>.via[].source` | `advisories.<id>.id` |
| Severity | `vulnerabilities.<pkg>.severity` | `advisories.<id>.severity` |
| Vulnerable package | Key of `vulnerabilities` object | `advisories.<id>.module_name` |
| Dependency path | `vulnerabilities.<pkg>.nodes` | `advisories.<id>.findings[].paths` |
| Fix available | `vulnerabilities.<pkg>.fixAvailable` | `advisories.<id>.patched_versions` |
| Severity counts | `metadata.vulnerabilities` | `metadata.vulnerabilities` |

## Extracting Severity Counts

Both formats provide severity counts at `metadata.vulnerabilities` with the same keys: `info`, `low`, `moderate`, `high`, `critical`. Use this path for consistent cross-PM summary generation.
