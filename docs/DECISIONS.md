# Architecture decisions

This file records decisions that should remain stable across stages. Change a decision through a pull request that explains the migration impact.

| Decision | Choice | Reason |
| --- | --- | --- |
| GitHub integration | GitHub App | Repository-scoped installation, short-lived tokens, and revocable access |
| Repository writes | Preview first; direct commit or pull request per repository | Different repositories have different protection requirements |
| Scheduler | Store due times; enqueue durable jobs | HTTP requests should not perform long repository jobs |
| Execution | Queue consumer or workflow per run | Retries, backoff, isolation, and observable state transitions |
| Structured data | D1 initially, partitioned when needed | Relational ownership and indexed history queries |
| Large patches/artifacts | R2 with short retention | Avoid large blobs in relational rows and logs |
| Local files | Explicit desktop companion | Browsers and PWAs cannot safely read arbitrary local work continuously |
| PWA cache | Static shell only by default | Prevent private repository data and tokens from entering shared browser caches |
| Secrets | Runtime secret store; no source/config secrets | Limits credential exposure and simplifies rotation |
| Automation default | Skip unchanged content | Prevent meaningless contribution activity and history noise |

