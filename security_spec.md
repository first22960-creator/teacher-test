# Security Specification for Exam System

This specification outlines the Zero-Trust security posture for the Firestore database.

## Data Invariants

1. **Role Separation**: Only the bootstrapped admin (`first22960@gmail.com`) can create categories, quizzes, and questions. Standard authenticated users can only view them and submit attempts.
2. **Identity Integrity**: For attempts, the `userId` in the document data must strictly match the authenticated user's ID (`request.auth.uid`), and `userEmail` must match `request.auth.token.email`.
3. **Temporal Integrity**: Fields like `createdAt` and `completedAt` must be set using the server's time (`request.time`) on creation.
4. **Immutability**: Once an attempt is created, it cannot be modified or deleted by anyone, including the user. Quizzes and questions cannot be updated by normal users.
5. **ID Poisoning prevention**: All document IDs must fall within safe formats (e.g., matching standard alphanumeric/slug criteria and under 128 characters).

---

## The "Dirty Dozen" Malicious Payloads

The following payloads represent malicious requests designed to breach database security and fail under the proposed ruleset.

### Collection: `/categories/{categoryId}`

1. **Category Identity Spoofing (Create)**:
   - *Payload*: `{"name": "Hacked", "description": "Hacked category", "createdAt": request.time, "createdBy": "some_other_uid"}`
   - *Failure Reason*: Creating a category with a mismatched `createdBy` field.

2. **Unverified User Category Write (Create)**:
   - *Auth state*: User has unverified email (`email_verified = false`).
   - *Payload*: `{"name": "Math", "description": "Math exam", "createdAt": request.time, "createdBy": request.auth.uid}`
   - *Failure Reason*: Must strictly mandate verified email.

3. **Standard User Category Write (Create)**:
   - *Auth state*: Standard authenticated user (`test@example.com`).
   - *Payload*: `{"name": "Physics", "description": "Physics exam", "createdAt": request.time, "createdBy": request.auth.uid}`
   - *Failure Reason*: Only admin user (`first22960@gmail.com`) is allowed to create categories.

### Collection: `/quizzes/{quizId}`

4. **Malicious Quiz Creation (Create)**:
   - *Auth state*: Standard user (`test@example.com`).
   - *Payload*: `{"categoryId": "math_id", "title": "Math Quiz", "description": "Math description", "timeLimit": 30, "questionsCount": 5, "createdAt": request.time, "createdBy": "standard_user"}`
   - *Failure Reason*: Standard user trying to create a quiz.

5. **Ghost field injection (Create)**:
   - *Auth state*: Admin user (`first22960@gmail.com`).
   - *Payload*: `{"categoryId": "math_id", "title": "Math Quiz", "description": "Math description", "timeLimit": 30, "questionsCount": 5, "createdAt": request.time, "createdBy": request.auth.uid, "secretGhostField": "maliciousSecret"}`
   - *Failure Reason*: Exceeds the strict key schema mapping (no ghost fields allowed).

### Collection: `/quizzes/{quizId}/questions/{questionId}`

6. **Question Injection by Non-Admin (Create)**:
   - *Auth state*: Standard user (`test@example.com`).
   - *Payload*: `{"text": "Is 1+1=2?", "options": ["Yes", "No"], "correctIndex": 0, "createdAt": request.time}`
   - *Failure Reason*: Only admin can add questions.

7. **Question with Negative Correct Index (Create)**:
   - *Auth state*: Admin (`first22960@gmail.com`).
   - *Payload*: `{"text": "Is 1+1=2?", "options": ["Yes", "No"], "correctIndex": -1, "createdAt": request.time}`
   - *Failure Reason*: `correctIndex` must be non-negative.

8. **Question Options Type Poisoning (Create)**:
   - *Auth state*: Admin (`first22960@gmail.com`).
   - *Payload*: `{"text": "Is 1+1=2?", "options": [123, 456], "correctIndex": 0, "createdAt": request.time}`
   - *Failure Reason*: `options` must contain string items.

### Collection: `/attempts/{attemptId}`

9. **Attempt Identity Spoofing (Create)**:
   - *Auth state*: Authenticated user (`user_A`).
   - *Payload*: `{"userId": "user_B", "userEmail": "user_b@test.com", "userName": "User B", "quizId": "quiz_1", "quizTitle": "Quiz 1", "score": 10, "totalQuestions": 10, "completedAt": request.time}`
   - *Failure Reason*: Creating an attempt record claiming to be another user.

10. **State/Score Injection (Create)**:
    - *Auth state*: Standard user (`user_A`).
    - *Payload*: `{"userId": "user_A", "userEmail": "user_a@test.com", "userName": "User A", "quizId": "quiz_1", "quizTitle": "Quiz 1", "score": 999, "totalQuestions": 10, "completedAt": request.time}`
    - *Failure Reason*: Scoring higher than total questions is mathematically invalid.

11. **Client Timestamp Override (Create)**:
    - *Auth state*: Standard user (`user_A`).
    - *Payload*: `{"userId": "user_A", "userEmail": "user_a@test.com", "userName": "User A", "quizId": "quiz_1", "quizTitle": "Quiz 1", "score": 8, "totalQuestions": 10, "completedAt": "2020-01-01T00:00:00Z"}`
    - *Failure Reason*: `completedAt` must equal the server transaction timestamp `request.time`.

12. **Attempt Modifier/Deletion Attack (Update/Delete)**:
    - *Auth state*: User B trying to edit or delete User A's attempts, or User A attempting to modify/delete their own historic attempts.
    - *Payload*: Edits field `score` to `10` or deletes attempt.
    - *Failure Reason*: Attempt records must be strictly immutable once submitted.

---

## Test Verification Configuration

The security rules will be generated to guarantee that all preceding 12 malicious assertions are rejected with `PERMISSION_DENIED` by default.
