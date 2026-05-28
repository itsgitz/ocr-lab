import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { OCR_LANGUAGES } from "shared";
import { processOCR } from "$lib/api";

export const load: PageServerLoad = () => {
  return {
    languages: OCR_LANGUAGES,
  };
};

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const image = formData.get("image");
    const language = (formData.get("language") as string) || "eng";

    if (!image || !(image instanceof File) || image.size === 0) {
      return fail(400, {
        error: "No image provided. Please select an image file.",
        language,
      });
    }

    try {
      const result = await processOCR(image, language);
      return { result, language };
    } catch (err) {
      console.error("OCR request failed:", err);
      const message =
        err instanceof Error ? err.message : "OCR processing failed";
      return fail(500, { error: message, language });
    }
  },
} satisfies Actions;
