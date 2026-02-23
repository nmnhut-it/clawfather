# Test Generation Skill

## Trigger
- User yêu cầu viết test, generate test
- User muốn tăng coverage
- User nói "code này chưa có test"

---

## Prerequisites Check
Verify project có:
- [ ] JUnit 5 (junit-jupiter)
- [ ] Mockito (mockito-core)
- [ ] AssertJ (assertj-core) - recommended
- [ ] JaCoCo plugin configured
- [ ] Testcontainers (optional, cho integration test)

---

## Execution Steps

### Step 1: Analyze Target Class

```
1. Đọc source code của class cần test
2. Identify public methods + signatures
3. Tìm dependencies (injected services)
4. Tìm existing tests: *Test.java, *Tests.java
5. Check coverage baseline nếu có JaCoCo
```

### Step 2: Chọn Test Strategy

**QUAN TRỌNG: Tránh over-mocking!**

| Situation | Strategy |
|-----------|----------|
| Pure logic (no deps) | Unit test, không mock |
| External deps (DB, API) | Mock hoặc Testcontainers |
| Complex integration | Testcontainers với real DB |
| Time-dependent | Inject Clock, stub time |

**Khi nào dùng Testcontainers thay mock:**
```java
// BAD - TestRepo không catch bug của real Couchbase SDK
class TestRepo extends RealRepo {
    ConcurrentHashMap<String, String> data;
    // SDK thật throw DocumentNotFoundException, fake trả null
}

// GOOD - Testcontainers với real DB
@Container
static CouchbaseContainer couchbase = new CouchbaseContainer("couchbase:7.2.4");
```

### Step 3: Refactor for Testability (nếu cần)

Nếu code khó test → prompt AI refactor TRƯỚC khi viết test:

```java
// BEFORE - phải mock static getInstance()
long now = TimeProvider.getInstance().getMillis();

// AFTER - inject Clock, dễ test
class TimeProvider {
    private Clock clock;

    void stubTime(long millis) { clock.setMillis(millis); }
    void resetStub() { clock.reset(); }
}
```

**Pattern: Tách logic ra hàm pure**
```java
// BEFORE - phải mock DB để test
bool isInEventTime() {
    loadEventTimeFromDB();  // DB call
    return start <= now && now <= end;
}

// AFTER - tách thành 2 tests
void loadEventTimeFromDB();  // Test với Testcontainers
bool isInEventTime(long start, long end, long now);  // Test logic thuần
```

### Step 4: Test Categories

| Priority | Category | Ví dụ |
|----------|----------|-------|
| 1 | **Cơ bản** (happy path) | User flow bình thường |
| 2 | **Ngoại lệ** (tampered input) | Client gửi gói tin sai, tool sửa packet |
| 3 | **Kịch bản** (scenario) | User nhận 7 phần quà trong 7 ngày |
| 4 | **Boundary** | 0, -1, MAX_VALUE, empty |
| 5 | **Edge Cases** | Concurrent, large data |

**Test Matrix cho case coverage:**
```
Method: calculateDiscount(amount, userType, isFirstPurchase)

| amount | userType | isFirstPurchase | expected |
|--------|----------|-----------------|----------|
| 100    | REGULAR  | true            | 10%      |
| 100    | REGULAR  | false           | 0%       |
| 100    | VIP      | true            | 20%      |
| 100    | VIP      | false           | 15%      |
| 0      | any      | any             | 0%       |
| -1     | any      | any             | ERROR    |
```

### Step 5: Handle Non-Deterministic Tests

**Time-dependent tests:**
```java
// BAD - fail vào tháng 2 năm nhuận
@Test void testMonthlyCount() {
    assertEquals(28, service.getDaysInMonth()); // Đôi khi 29!
}

// GOOD - fix cứng thời gian
@Test void testMonthlyCount() {
    TimeProvider.getInstance().stubTime(
        LocalDate.of(2024, 1, 15).toEpochDay() * 86400000
    );
    assertEquals(31, service.getDaysInMonth());
}
```

**Shared state tests:**
```java
// BAD - test này làm nhiễu test khác
static User sharedUser;

@Test void test1() { sharedUser = create(); }
@Test void test2() { update(sharedUser); }  // Fail nếu test1 chưa chạy

// GOOD - mỗi test độc lập
@BeforeEach void setup() { user = createTestUser(); }
```

### Step 6: Generate Test Code

**Template:**
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @InjectMocks private UserService userService;

    @Nested
    @DisplayName("createUser")
    class CreateUser {

        @Test
        @DisplayName("should create user when valid input")
        void should_create_when_valid() {
            // Arrange
            var request = new CreateUserRequest("John", "john@example.com");
            when(userRepository.save(any())).thenReturn(savedUser);

            // Act
            var result = userService.createUser(request);

            // Assert - PHẢI có meaningful assertion
            assertThat(result.getName()).isEqualTo("John");
            verify(userRepository).save(any());
        }
    }
}
```

### Step 7: Compile + Run + Self-Heal

```bash
mvn test -Dtest=<TestClassName>
```

**Auto-fix loop (max 3 rounds):**
1. Run test
2. Parse errors
3. Fix và retry

| Error | Fix |
|-------|-----|
| Import not found | Check actual class names |
| Method not found | Verify signature với source |
| Mock setup wrong | Check return types |

### Step 8: Coverage Boosting

```bash
mvn test jacoco:report
# Parse: target/site/jacoco/jacoco.xml
```

**Stop khi:**
- Coverage đạt 70-80%
- Delta < 3% (diminishing returns)
- Đã 3 rounds
- Uncovered = unreachable code

---

## Anti-Patterns to Avoid

| Pattern | Why Bad | Fix |
|---------|---------|-----|
| Mock quá nhiều | Test mocks, không test code | Refactor for testability |
| Test only verify() | Không assert kết quả | Thêm meaningful assertions |
| Fake implementation | Không catch real bugs | Dùng Testcontainers |
| Test impl khác | Test ConcurrentHashMap thay Couchbase | Test real dependency |
| Generic names | testMethod1() | should_X_when_Y() |
| Time-dependent | Fail random | Stub Clock |

---

## Output Format

```markdown
## Test Generation: [ClassName]

### Strategy
- Unit test với mock: X methods
- Integration test với Testcontainers: Y methods
- Refactored for testability: Z methods

### Generated Tests
- Total: N tests
- File: src/test/java/.../XxxTest.java

### Coverage
| Metric | Before | After |
|--------|--------|-------|
| Line   | X%     | Y%    |
| Branch | X%     | Y%    |

### Test Matrix
[Include for complex methods]
```
