import { test, expect } from "@playwright/test";

test.describe("ChatBox Feature E2E Test Suite", () => {
  // Navigate to the chat page before each test case
  test.beforeEach(async ({ page }) => {
    // Mock API call for list of models
    await page.route("**/llm/providers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "groq",
            name: "Groq",
            models: [{ id: "openai/gpt-oss-120b", name: "GPT OSS 120B" }],
          },
        ]),
      });
    });
    // Adjust the URL path to match routing configuration
    await page.goto("/chat");
    // Wait for page to load
    const textarea = page.locator("textarea");
    await textarea.waitFor({ state: "visible", timeout: 10000 });
  });

  /**
   * Test case 1: Verify initial UI state where textarea is empty
   * and the submit button is disabled.
   */
  test("1. Initial state disables submit button when input is empty", async ({
    page,
  }) => {
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("");

    //const submitButton = page.locator('button[type="submit"]');
    const submitButton = page.getByTestId("send-msg-button");
    await expect(submitButton).toBeDisabled();
  });

  /**
   * Test case 2: Verify that typing text into the textarea
   * dynamically enables the submit button.
   */
  test("2. Typing text enables the submit button", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("Hello, how are you?");

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  /**
   * Test case 3: Complete streaming happy path.
   * Intercepts the backend streaming endpoint, submits a message via Enter or click,
   * verifies input locking, buffer flushing, and UI updates.
   */
  test("3. [Streaming Flow] Submit message and render streamed assistant response", async ({
    page,
  }) => {
    // call service
    await page.route("**/llm/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"content": "Hello"}\n\ndata: {"content": " from"}\n\ndata: {"content": " AI stream!"}\n\ndata: [DONE]\n\n',
      });
    });

    const textarea = page.locator("textarea");
    await textarea.fill("Tell me a joke");

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Xác thực UI đã render ra chuỗi văn bản được stream
    await expect(page.getByText(/Hello from AI stream/i)).toBeVisible({
      timeout: 10000,
    });

    // Xác thực input được mở khóa sau khi hoàn tất
    await expect(textarea).toHaveValue("");
  });

  /**
   - Test case 4: [Error Flow] Verify error banner is displayed
   - when backend returns a 429 error (Daily token limit exceeded).
   */
  test("4. [Error Flow] Display error message banner when hitting token limit", async ({
    page,
  }) => {
    // Intercept chat endpoint và ép trả về lỗi 429 Too Many Requests
    await page.route("**/llm/chat", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Daily token limit exceeded" }),
      });
    });

    const textarea = page.locator("textarea");
    await textarea.fill("Tell me a long story");

    // const submitButton = page.locator('button[type="submit"]');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 👉 Xác thực component ErrorMessage hiển thị đúng nội dung lỗi từ backend
    await expect(page.getByText(/Error: Daily token limit exceeded/i)).toBeVisible({
      timeout: 10000,
    });

    // (Tùy chọn) Kiểm tra có nút đóng (✕) hoặc người dùng có thể click ẩn lỗi đi
    // const closeButton = page.locator('button[aria-label="Close error"]');
    // await expect(closeButton).toBeVisible();
  });
});
