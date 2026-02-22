---
name: email-draft
description: Soạn email trong Gmail hoặc Outlook Web - mở trình duyệt với nội dung đã điền sẵn
metadata: {"nanobot":{"emoji":"📧"}}
---

# Email Draft - Soạn Email

## Khi nào sử dụng

- User nói "draft email", "soạn email", "viết mail"
- User nói "gửi email cho...", "email cho sếp về..."
- Kết hợp với Boss Advisor để soạn email chuyên nghiệp

## Cách hoạt động

Mở trình duyệt với URL compose của Gmail hoặc Outlook Web.
User sẽ review và bấm Send thủ công.

## URL Templates

### Gmail
```
https://mail.google.com/mail/?view=cm&to=EMAIL&cc=CC&bcc=BCC&su=SUBJECT&body=BODY
```

### Outlook.com (cá nhân)
```
https://outlook.live.com/mail/0/deeplink/compose?to=EMAIL&cc=CC&bcc=BCC&subject=SUBJECT&body=BODY
```

### Office 365 (công ty)
```
https://outlook.office.com/mail/deeplink/compose?to=EMAIL&cc=CC&bcc=BCC&subject=SUBJECT&body=BODY
```

## Quy trình

1. **Xác định email provider** của user (hỏi nếu chưa biết: Gmail hay Outlook?)
2. **URL-encode** tất cả nội dung (subject, body, cc, bcc)
3. **Mở browser** bằng script trong workspace:
   - Cross-platform: `exec ./skills/email-draft/open-url.sh "URL"`
   - Windows only: `exec ./skills/email-draft/open-url.bat "URL"`

## Ví dụ

### Gmail
```bash
exec ./skills/email-draft/open-url.sh "https://mail.google.com/mail/?view=cm&to=boss@company.com&su=Project%20Update&body=Dear%20Boss%2C%0A%0AProject%20is%2080%25%20complete."
```

### Outlook
```bash
exec ./skills/email-draft/open-url.sh "https://outlook.live.com/mail/0/deeplink/compose?to=boss@company.com&subject=Project%20Update&body=Dear%20Boss%2C%0A%0AProject%20is%2080%25%20complete."
```

## URL Encoding

| Character | Encoded |
|-----------|---------|
| Space | %20 |
| Newline | %0A |
| , | %2C |
| ? | %3F |
| & | %26 |
| = | %3D |

## Kết hợp với Boss Advisor

1. User: "Draft email cho sếp về tiến độ dự án"
2. Bot dùng Boss Advisor để soạn nội dung chuyên nghiệp (BLUF format)
3. Bot URL-encode nội dung
4. Bot mở Gmail/Outlook compose với nội dung đã điền

## Ví dụ trả lời

**User:** "Draft email cho sếp Trung về tiến độ, dùng Gmail"

**Bot:**
```
📧 Đang mở Gmail compose...

Nội dung đã soạn (BLUF format):
---
To: [cần điền email sếp]
Subject: Cập nhật tiến độ dự án

Dự án hoàn thành 80%, dự kiến xong thứ 6.
✅ Done: Module A, B
🔄 Đang làm: Module C
---

[Mở browser với Gmail compose]
📧 Đã mở Gmail - kiểm tra và bấm Send!
```
