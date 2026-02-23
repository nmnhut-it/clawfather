---
name: zest
description: Code review đa tầng (AdaBoost), sinh test tự động, đánh giá chất lượng test
metadata: {"nanobot":{"emoji":"🔍"}}
---

# Zest - Code Quality Analysis

## Khi nào sử dụng

- User nói "review code", "check code", "kiểm tra code"
- User nói "generate test", "sinh test", "viết test"
- User nói "review test", "đánh giá test", "test quality"

## 3 chế độ

### 1. Code Review (multi-pass)
Phân tích code qua 6 lượt chuyên biệt (inspired by AdaBoost):
Pass 1: Static Tools (PMD, Semgrep) → Pass 2: Security → Pass 3: Logic → Pass 4: Resources → Pass 5: Structure → Pass 6: Logging

Đọc hướng dẫn chi tiết: `read_file("./skills/zest/code-review.md")`

### 2. Test Generation
Sinh test với coverage boosting (8 steps):
Analyze → Strategy → Refactor → Generate → Compile & Run → Auto-heal → Coverage boost

Đọc hướng dẫn chi tiết: `read_file("./skills/zest/test-generation.md")`

### 3. Test Review
Đánh giá chất lượng test theo 4 tiêu chí:
- Real-World Relevance (35%) | Mocking Strategy (30%)
- Maintainability (20%) | Bug Detection (15%)

Đọc hướng dẫn chi tiết: `read_file("./skills/zest/test-review.md")`

## Scripts

### Static Analysis
```bash
exec ./skills/zest/run-pmd.sh check <file> [language]
exec ./skills/zest/run-pmd.sh cpd <directory> [language]
exec ./skills/zest/run-semgrep.sh <file_or_directory>
```

### Cài đặt tools (chạy một lần)
```bash
exec ./skills/zest/install-tools.sh
```

### Windows
Thay `.sh` bằng `.bat`

## Team Knowledge Base

Đọc patterns hay gặp: `read_file("./skills/zest/experience.md")`
