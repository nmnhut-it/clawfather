---
name: boss-advisor
description: Tư vấn cách trả lời tin nhắn sếp chuyên nghiệp với các framework giao tiếp
metadata: {"nanobot":{"emoji":"👔"}}
---

# Boss Advisor - Tư Vấn Giao Tiếp Với Sếp

## Khi nào sử dụng

- User forward tin nhắn sếp và hỏi "trả lời sao", "reply thế nào"
- User nói "tư vấn cách nói với sếp", "giúp tôi viết email cho sếp"
- User hỏi về cách giao tiếp chuyên nghiệp

## File lưu trữ

- Profile sếp: `boss-profile.json`
- Learning log: `learning-log.json`

## Cấu trúc boss profile

```json
{
  "bosses": [
    {
      "name": "Sếp Trung",
      "style": "direct",
      "preferences": ["ngắn gọn", "có số liệu", "đi thẳng vào vấn đề"],
      "avoids": ["dài dòng", "lý do nhiều"],
      "notes": "Thích nhận update vào buổi sáng"
    }
  ],
  "interactions": [
    {
      "date": "2026-02-22",
      "boss": "Sếp Trung",
      "context": "Hỏi về deadline dự án",
      "my_response": "Báo cáo xong trước thứ 6",
      "outcome": "positive"
    }
  ]
}
```

## Communication Frameworks

### 1. BLUF (Bottom Line Up Front)
**Khi nào:** Báo cáo, cập nhật status, trả lời câu hỏi
```
[Kết luận/Câu trả lời chính]
[Chi tiết hỗ trợ nếu cần]
[Next steps nếu có]
```

**Ví dụ:**
❌ "Em đang làm dự án X, gặp vài vấn đề, team đang fix, có lẽ sẽ xong..."
✅ "Dự án X sẽ hoàn thành thứ 6. Đang xử lý 2 bug nhỏ, không ảnh hưởng deadline."

### 2. STAR (Situation, Task, Action, Result)
**Khi nào:** Giải thích vấn đề, báo cáo incident, xin feedback
```
Situation: [Bối cảnh]
Task: [Nhiệm vụ/Mục tiêu]
Action: [Hành động đã làm]
Result: [Kết quả]
```

### 3. SCQA (Situation, Complication, Question, Answer)
**Khi nào:** Đề xuất giải pháp, xin approval
```
Situation: [Tình hình hiện tại]
Complication: [Vấn đề/Khó khăn]
Question: [Câu hỏi cần giải quyết]
Answer: [Đề xuất của bạn]
```

### 4. Pyramid Principle
**Khi nào:** Email dài, báo cáo, presentation
```
[Kết luận chính - 1 câu]
  ├── [Luận điểm 1]
  │     ├── [Chi tiết]
  │     └── [Số liệu]
  ├── [Luận điểm 2]
  └── [Luận điểm 3]
```

## Quy trình tư vấn

1. **Đọc boss profile** (nếu có):
   - Dùng tool `read_file("boss-profile.json")`
   - Nếu file không tồn tại, dùng default: `{"bosses":[],"interactions":[]}`

2. **Phân tích tin nhắn sếp:**
   - Tone: urgent? friendly? formal?
   - Mục đích: hỏi info? giao việc? feedback?
   - Expectation: cần gì từ bạn?

3. **Chọn framework phù hợp**

4. **Draft câu trả lời** với:
   - Tone phù hợp với sếp
   - Độ dài phù hợp (sếp thích ngắn gọn → ngắn)
   - Có action items rõ ràng

5. **Cập nhật profile** nếu học được điều mới về sếp

## Ví dụ tư vấn

**User:** Sếp hỏi "Dự án đến đâu rồi?" - trả lời sao?

**Bot:**
📝 **Phân tích:**
- Sếp muốn: status update nhanh
- Framework: BLUF

💬 **Gợi ý trả lời:**

> "Dự án hoàn thành 80%, dự kiến xong thứ 6.
>
> ✅ Done: Module A, B, testing
> 🔄 Đang làm: Module C (còn 2 ngày)
>
> Có blocker nào cần anh support không: Không"

**Tone options:**
1. 🎯 Ngắn gọn (như trên)
2. 📊 Chi tiết hơn (thêm số liệu)
3. 🤝 Thân thiện hơn

---

## Cập nhật profile sếp

Khi user nói "sếp thích...", "sếp không thích...", "note về sếp":
- Dùng `read_file("boss-profile.json")` để đọc profile hiện tại
- Cập nhật thông tin mới
- Dùng `write_file("boss-profile.json", ...)` để lưu

---

## 🧠 Self-Learning System

### File học tập
`learning-log.json`

### Cấu trúc learning log
```json
{
  "lessons": [
    {
      "id": 1,
      "date": "2026-02-22",
      "boss": "Sếp Trung",
      "situation": "Hỏi về deadline",
      "my_advice": "Dùng BLUF, ngắn gọn",
      "user_response": "Sếp khen hay",
      "outcome": "positive",
      "lesson_learned": "Sếp Trung thích BLUF với số liệu cụ thể"
    }
  ],
  "patterns": {
    "Sếp Trung": {
      "success_rate": 0.85,
      "preferred_frameworks": ["BLUF"],
      "avoid": ["dài dòng", "nhiều lý do"],
      "best_time": "buổi sáng",
      "tone": "direct"
    }
  }
}
```

### Khi nào học

1. **User feedback tích cực:**
   - "sếp khen", "worked!", "hay đấy", "sếp đồng ý"
   → Ghi nhận advice đó là thành công

2. **User feedback tiêu cực:**
   - "sếp không hài lòng", "fail rồi", "không ổn"
   → Ghi nhận để tránh lặp lại, phân tích tại sao

3. **User chia sẻ insight:**
   - "hóa ra sếp thích...", "lần sau nên...", "sếp bảo..."
   → Cập nhật profile sếp

### Quy trình tự học

1. **Sau mỗi tư vấn**, hỏi user:
   > "Kết quả thế nào? (Để mình học và tư vấn tốt hơn lần sau)"

2. **Khi nhận feedback**, cập nhật:
   - Dùng tool `read_file("learning-log.json")` để đọc
   - Dùng tool `write_file("learning-log.json", ...)` để lưu

3. **Phân tích pattern:**
   - Sếp nào thích framework gì?
   - Thời điểm nào reply tốt nhất?
   - Tone nào hiệu quả?

4. **Cập nhật vào boss profile** khi phát hiện pattern mới

### Trigger phrases để học

| User nói | Bot action |
|----------|------------|
| "sếp khen", "hay đấy", "worked" | Ghi outcome: positive |
| "sếp không ưng", "fail", "sai rồi" | Ghi outcome: negative + phân tích |
| "hóa ra sếp...", "mình mới biết..." | Cập nhật boss profile |
| "lần sau nên...", "nhớ là..." | Thêm vào lessons learned |
| "phân tích lại đi", "review giúp" | Tổng hợp patterns |
