# Test Review Skill

Review chất lượng test cho Java project.

## Trigger
- "review test", "check test"
- "test này có tốt không"

---

## Steps

### 1. Đọc Test File

```
Read test file và source file được test (SUT - System Under Test)
```

### 2. Static Analysis với PMD

```bash
exec ./skills/zest/run-pmd.sh check <test-file>
```

### 3. Evaluation Checklist

#### 3.1 Real-World Relevance (35%)

| ID | Criteria | Check |
|----|----------|-------|
| A1 | Test reflect user workflows thật | [ ] |
| A2 | Test cover edge cases xảy ra trong production | [ ] |
| A3 | Test validate business rules, không chỉ technical | [ ] |
| A4 | Test data giống production data | [ ] |
| B1 | Test verify outcomes users care about | [ ] |
| B2 | Test catch bugs mà users sẽ report | [ ] |
| ** | **Các issues khác** phát hiện được | [ ] |

**Red Flags:**
- Test validate internal state không có business meaning
- Test scenarios không bao giờ xảy ra trong thực tế
- Test pass nhưng feature vẫn broken với users

#### 3.2 Mocking Strategy (30%)

| ID | Criteria | Check |
|----|----------|-------|
| C1 | Mock CHỈ infrastructure/external deps | [ ] |
| C2 | Business logic KHÔNG bị mock | [ ] |
| C3 | Mock depth ≤ 2 levels | [ ] |
| C4 | Real objects cho domain models | [ ] |
| D1 | Mock return values realistic | [ ] |
| D2 | Mock failures simulate real errors | [ ] |
| ** | **Các mocking issues khác** phát hiện được | [ ] |

**Red Flags:**
- Mock domain services/business logic
- Test thành "mock verification" thay vì behavior test
- Mock setup dài hơn test logic
- Mock bypass validations mà real code enforce

#### 3.3 Maintainability (20%)

| ID | Criteria | Check |
|----|----------|-------|
| F1 | Test không break khi refactor implementation | [ ] |
| F2 | Không check call counts/order trừ khi critical | [ ] |
| F3 | Test independent (no shared state) | [ ] |
| G1 | Test name rõ scenario + expected outcome | [ ] |
| G2 | Arrange-Act-Assert pattern clear | [ ] |
| G3 | Test < 50 lines | [ ] |
| ** | **Các maintainability issues khác** phát hiện được | [ ] |

**Red Flags:**
- Test break khi rename variables/methods
- Test verify "how" thay vì "what"
- Test có nested loops/conditions
- Setup > 20 lines

#### 3.4 Bug Detection (15%)

| ID | Criteria | Check |
|----|----------|-------|
| I1 | Nếu introduce bug, test có catch? | [ ] |
| I2 | Nếu xóa 1 line code, test có fail? | [ ] |
| I3 | Assertions specific (không chỉ != null) | [ ] |
| I4 | Test verify complete state changes | [ ] |
| ** | **Các bug detection issues khác** phát hiện được | [ ] |

**Red Flags:**
- Test pass dù có obvious bugs
- Test chỉ check happy path
- Weak assertions (chỉ check nullity/type)

---

## Anti-Patterns (tự động fail)

| Code | Anti-Pattern | Example |
|------|--------------|---------|
| ANTI-1 | Test chỉ verify mock, không assert gì | `verify(repo).save(any())` only |
| ANTI-2 | Test không có assertion | No assert/assertThat |
| ANTI-3 | Test luôn pass dù code sai | Liar test |
| ANTI-4 | Test chỉ để tăng coverage | Coverage filler |
| ANTI-5 | Test trùng lặp test khác | Redundant |
| ANTI-6 | Test setup phức tạp hơn code | 100+ lines setup |
| ANTI-7 | Test phụ thuộc test khác | Shared state |

---

## Key Questions

Hỏi với MỖI test:

1. **"So What?"**: Nếu test fail, vấn đề thực sự là gì?
2. **"Realism"**: Scenario này có xảy ra trong production?
3. **"Refactor"**: Nếu rename methods, test có break?
4. **"Mock Test"**: Đang test code hay test mocks?
5. **"Value"**: Test có đáng maintenance cost?

---

## Common Issues

### Missing Assertions
```java
// BAD - chỉ verify mock
@Test void testProcess() {
    service.process(input);
    verify(repo).save(any());  // Không assert result!
}

// GOOD
@Test void testProcess_shouldReturnSuccess() {
    Result result = service.process(input);
    assertThat(result.getStatus()).isEqualTo(SUCCESS);
}
```

### Over-mocking
```java
// BAD - mock quá nhiều, test nothing real
when(service.validate(any())).thenReturn(true);
when(service.process(any())).thenReturn(result);

// GOOD - chỉ mock external deps
when(externalApi.call(any())).thenReturn(apiResponse);
```

### Missing Edge Cases
```java
// BAD - chỉ happy path
@Test void testDivide() {
    assertEquals(10, calc.divide(100, 10));
}

// GOOD - có edge cases
@Test void testDivide_byZero_shouldThrow() {
    assertThrows(ArithmeticException.class,
        () -> calc.divide(100, 0));
}
```

---

## Output Format

```markdown
## Test Review: <TestClassName>

### Summary
- **Score**: X/100
- **SUT**: <SourceClassName>
- **Test Count**: N tests

### Scores
| Category | Score | Notes |
|----------|-------|-------|
| Real-World | X/35 | ... |
| Mocking | X/30 | ... |
| Maintainability | X/20 | ... |
| Bug Detection | X/15 | ... |

### Anti-Patterns Found
- [ANTI-X]: Description

### Key Questions Failed
- "So What?": Test X has no clear business value
- "Mock Test": Test Y is testing mocks

### Issues
| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | ... | High | ... |

### Recommendations
1. ...
2. ...
```

## Verdict Scale

| Score | Verdict | Action |
|-------|---------|--------|
| 90-100 | Excellent | Giữ nguyên |
| 75-89 | Good | Cải thiện nhỏ |
| 60-74 | OK | Nên refactor |
| 40-59 | Poor | Cần refactor lớn |
| 0-39 | Worthless | Xóa hoặc viết lại |
