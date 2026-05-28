import { test, expect, mock } from "bun:test";
import type { OCRResult } from "shared";

const mockFetch = mock<(url: string, init?: RequestInit) => Promise<Response>>();

const API_URL = "http://localhost:3001";

function createMockFile(
  name = "test.png",
  type = "image/png",
  size = 1024,
): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

mock.module("$lib/api", () => ({
  processOCR: async (image: File, language: string): Promise<OCRResult> => {
    const response = await mockFetch(`${API_URL}/api/ocr`);

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "OCR processing failed");
    }

    return response.json();
  },
}));

const { actions } = await import("../src/routes/+page.server");

function createRequestEvent(
  overrides: Partial<{
    image: File | null;
    language: string;
  }> = {},
) {
  const { image = createMockFile(), language = "eng" } = overrides;

  const formData = new FormData();
  if (image) formData.append("image", image);
  if (language) formData.append("language", language);

  return {
    request: new Request("http://localhost:3000", {
      method: "POST",
      body: formData,
    }),
    fetch: mockFetch,
    url: new URL("http://localhost:3000"),
    params: {},
    route: { id: "/" },
    locals: {},
    platform: undefined,
    isDataRequest: false,
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => "",
    },
  };
}

test("returns result on successful OCR", async () => {
  const expected: OCRResult = {
    text: "Hello World",
    confidence: 95.5,
    language: "eng",
    processingTimeMs: 1234,
  };

  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(expected), { status: 200 }),
  );

  const event = createRequestEvent();
  const result = await actions.default(event as any);

  expect(result).toEqual({ result: expected, language: "eng" });
});

test("returns 400 when no image provided", async () => {
  const event = createRequestEvent({ image: null });
  const result = await actions.default(event as any);

  // fail() returns ActionFailure { data, status }
  expect(result.status).toBe(400);
  expect(result.data).toEqual({
    error: "No image provided. Please select an image file.",
    language: "eng",
  });
});

test("returns 400 when image is empty file", async () => {
  const emptyFile = createMockFile("empty.png", "image/png", 0);
  const event = createRequestEvent({ image: emptyFile });
  const result = await actions.default(event as any);

  expect(result.status).toBe(400);
  expect(result.data).toEqual({
    error: "No image provided. Please select an image file.",
    language: "eng",
  });
});

test("returns 500 on API failure", async () => {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "OCR processing failed" }), {
      status: 500,
    }),
  );

  const event = createRequestEvent();
  const result = await actions.default(event as any);

  expect(result.status).toBe(500);
  expect(result.data).toEqual({
    error: "OCR processing failed",
    language: "eng",
  });
});

test("passes language parameter to API", async () => {
  const expected: OCRResult = {
    text: "Bonjour le monde",
    confidence: 92.0,
    language: "fra",
    processingTimeMs: 1500,
  };

  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(expected), { status: 200 }),
  );

  const event = createRequestEvent({ language: "fra" });
  const result = await actions.default(event as any);

  expect(result).toEqual({ result: expected, language: "fra" });
});

test("returns 500 on network error", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));

  const event = createRequestEvent();
  const result = await actions.default(event as any);

  expect(result.status).toBe(500);
  expect(result.data).toEqual({
    error: "Network error",
    language: "eng",
  });
});
