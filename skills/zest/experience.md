# Experience - Các lỗi hay gặp

Ghi chép các lỗi phổ biến. AI cần check kỹ các pattern này khi review code.

> **Note**: File này là template. Customize theo experience của team.

---

## Java Common Issues

### 1. NullPointerException

**Pattern hay gặp:**
```java
// BAD
user.getProfile().getAddress().getCity()  // NPE nếu profile hoặc address null

// GOOD
Optional.ofNullable(user)
    .map(User::getProfile)
    .map(Profile::getAddress)
    .map(Address::getCity)
    .orElse("Unknown");
```

**Check kỹ:**
- Method nhận param có thể null
- Return value từ repository/external API
- Collection có thể empty

### 2. Hardcoded Values

**Pattern hay gặp:**
```java
// BAD
if (status == 1) { ... }  // Magic number
if (type.equals("ACTIVE")) { ... }  // Hardcoded string

// GOOD
if (status == Status.ACTIVE.getValue()) { ... }
if (type.equals(UserType.ACTIVE.name())) { ... }
```

**Check kỹ:**
- Số magic trong conditions
- String literals trong comparisons
- Timeout values, retry counts

### 3. Exception Handling

**Pattern hay gặp:**
```java
// BAD - swallow exception
try {
    riskyOperation();
} catch (Exception e) {
    log.error("Error");  // Mất stack trace!
}

// GOOD
try {
    riskyOperation();
} catch (SpecificException e) {
    log.error("Operation failed: {}", e.getMessage(), e);
    throw new BusinessException("User-friendly message", e);
}
```

### 4. Resource Leaks

**Pattern hay gặp:**
```java
// BAD
InputStream is = new FileInputStream(file);
// ... use is
// Quên close!

// GOOD
try (InputStream is = new FileInputStream(file)) {
    // ... use is
}  // Auto-close
```

**Check kỹ:**
- Streams, Connections, Readers/Writers
- Database connections
- HTTP clients

---

## Test Issues

### 1. Test không có assertion

```java
// BAD
@Test
void testSave() {
    service.save(entity);
    verify(repo).save(any());  // Chỉ verify, không assert!
}
```

### 2. Test phụ thuộc lẫn nhau

```java
// BAD - test 2 depend on test 1
static User createdUser;

@Test
void test1_createUser() {
    createdUser = service.create(dto);
}

@Test
void test2_updateUser() {
    service.update(createdUser.getId(), newDto);  // Fail nếu test1 chưa chạy!
}
```

### 3. Missing edge case tests

- Null input
- Empty collection
- Boundary values (0, -1, MAX_VALUE)
- Concurrent access

---

## Architecture Issues

### 1. Circular Dependencies

```java
// BAD
@Service
class ServiceA {
    @Autowired ServiceB serviceB;
}

@Service
class ServiceB {
    @Autowired ServiceA serviceA;  // Circular!
}
```

### 2. Business Logic in Controller

```java
// BAD
@PostMapping
public Response create(@RequestBody Dto dto) {
    if (dto.getAmount() > 1000) {
        dto.setDiscount(10);
    }
    return service.save(dto);
}

// GOOD - logic trong service
@PostMapping
public Response create(@RequestBody Dto dto) {
    return service.createWithBusinessRules(dto);
}
```

### 3. N+1 Query Problem

```java
// BAD
List<User> users = userRepo.findAll();
for (User user : users) {
    List<Order> orders = orderRepo.findByUserId(user.getId());  // N queries!
}

// GOOD
List<User> users = userRepo.findAllWithOrders();  // JOIN fetch
```

---

## Security Issues

### 1. SQL Injection

```java
// BAD
String query = "SELECT * FROM users WHERE name = '" + name + "'";

// GOOD
@Query("SELECT u FROM User u WHERE u.name = :name")
User findByName(@Param("name") String name);
```

### 2. Sensitive Data Logging

```java
// BAD
log.info("User login: {}", user);  // Có thể log password!

// GOOD
log.info("User login: id={}", user.getId());
```

### 3. Missing Input Validation

```java
// BAD
public void transfer(Long fromId, Long toId, BigDecimal amount) {
    accountService.transfer(fromId, toId, amount);
}

// GOOD
public void transfer(Long fromId, Long toId, @Positive BigDecimal amount) {
    Objects.requireNonNull(fromId, "fromId required");
    Objects.requireNonNull(toId, "toId required");
    accountService.transfer(fromId, toId, amount);
}
```

---

## Performance Issues

### 1. Unnecessary Object Creation

```java
// BAD - tạo object trong loop
for (int i = 0; i < 1000; i++) {
    DateFormat df = new SimpleDateFormat("yyyy-MM-dd");
}

// GOOD
private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
```

### 2. String Concatenation in Loop

```java
// BAD
String result = "";
for (String s : list) {
    result += s;  // Tạo String mới mỗi lần!
}

// GOOD
StringBuilder sb = new StringBuilder();
for (String s : list) {
    sb.append(s);
}
```

---

## Adding New Experience

Khi phát hiện lỗi mới hay gặp, thêm theo format:

```markdown
### N. Tên vấn đề

**Pattern hay gặp:**
\`\`\`java
// BAD
...

// GOOD
...
\`\`\`

**Check kỹ:**
- Điểm 1
- Điểm 2
```
