<script lang="ts">
  import type { PageProps } from "./$types";
  import { enhance } from "$app/forms";

  let { data, form }: PageProps = $props();

  let isDragging = $state(false);
  let isSubmitting = $state(false);
  let previewUrl: string | null = $state(null);
  let uploadedFileName: string | null = $state(null);
  let fileInput: HTMLInputElement;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith("image/")) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      uploadedFileName = file.name;
      showPreview(file);
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      uploadedFileName = file.name;
      showPreview(file);
    }
  }

  function showPreview(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
  }

  function handleEnhance() {
    isSubmitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      isSubmitting = false;
      fileInput.value = "";
      previewUrl = null;
      uploadedFileName = null;
    };
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard not available */
    }
  }
</script>

<svelte:head>
  <title>OCR Lab</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
  <h1 class="text-center text-3xl font-bold tracking-tight sm:text-4xl">
    OCR Lab
  </h1>
  <p class="mt-2 text-center text-gray-500">
    Extract text from images instantly
  </p>

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={handleEnhance}
    class="mt-8 space-y-6"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors {isDragging
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-300 hover:border-gray-400'}"
      role="button"
      tabindex="0"
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") fileInput?.click();
      }}
      ondragover={(e) => {
        e.preventDefault();
        isDragging = true;
      }}
      ondragleave={() => {
        isDragging = false;
      }}
      ondrop={handleDrop}
      onclick={() => fileInput?.click()}
    >
      <input
        bind:this={fileInput}
        type="file"
        name="image"
        accept="image/png,image/jpeg,image/gif,image/bmp,image/webp"
        required
        class="hidden"
        onchange={handleFileChange}
      />

      {#if previewUrl}
        <img
          src={previewUrl}
          alt="Upload preview"
          class="max-h-48 rounded-lg object-contain"
        />
      {:else if uploadedFileName}
        <p class="text-sm text-gray-600">{uploadedFileName}</p>
      {:else}
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p class="mt-2 text-sm text-gray-600">
          <span class="font-semibold text-blue-600">Click to upload</span>
          or drag and drop
        </p>
        <p class="mt-1 text-xs text-gray-500">
          PNG, JPEG, GIF, BMP, WebP (max 10MB)
        </p>
      {/if}
    </div>

    {#if form?.error}
      <div
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {form.error}
      </div>
    {/if}

    <div class="flex gap-3">
      <select
        name="language"
        class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {#each Object.entries(data.languages) as [code, label]}
          <option value={code} selected={code === "eng"}>{label}</option>
        {/each}
      </select>

      <button
        type="submit"
        disabled={isSubmitting}
        class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isSubmitting ? "Processing…" : "Extract Text"}
      </button>
    </div>
  </form>

  {#if form?.result}
    <div class="mt-8 space-y-4">
      <h2 class="text-lg font-semibold">Extracted Text</h2>

      <pre
        class="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-white p-4 font-mono text-sm leading-relaxed"
      >{form.result.text}</pre>

      <div
        class="flex flex-wrap items-center gap-4 text-sm text-gray-600"
      >
        <span
          >Confidence:
          <strong>{form.result.confidence}%</strong></span
        >
        <span
          >Time:
          <strong
          >{(form.result.processingTimeMs / 1000).toFixed(1)}s</strong></span
        >
        <span
          >Language:
          <strong>{form.result.language}</strong></span
        >
      </div>

      <button
        onclick={() => copyToClipboard(form.result.text)}
        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Copy to Clipboard
      </button>
    </div>
  {/if}
</div>
