<script lang="ts">
  import type { PageProps } from "./$types";
  import { enhance } from "$app/forms";
  import UploadZone from "$lib/components/UploadZone.svelte";
  import TimelinePill from "$lib/components/TimelinePill.svelte";

  let { data, form }: PageProps = $props();

  let isDragging = $state(false);
  let isSubmitting = $state(false);
  let previewUrl: string | null = $state(null);
  let uploadedFileName: string | null = $state(null);
  let fileInput: HTMLInputElement = $state() as unknown as HTMLInputElement;

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
  <title>OCR Lab — Extract Text from Images</title>
</svelte:head>

<div class="mx-auto max-w-[640px] px-6 pb-section pt-section sm:px-10 sm:pt-section">
  <div class="text-center">
    <div class="typo-caption-uppercase mb-6 text-muted tracking-[1.5px]">
      OCR Tool
    </div>
    <h1 class="typo-display-mega text-ink">
      Extract text<br />from images
    </h1>
    <p class="typo-body-md mx-auto mt-4 max-w-lg text-balance text-body">
      Upload a screenshot or photo and get clean, copyable text in seconds. No sign-up required.
    </p>
  </div>

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={handleEnhance}
    class="mt-section space-y-6"
  >
    <div class="rounded-lg border border-hairline bg-surface-card p-6 sm:p-8">
      <UploadZone
        bind:isDragging
        bind:previewUrl
        bind:uploadedFileName
        bind:fileInput
        {handleDrop}
        {handleFileChange}
      />
    </div>

    {#if form?.error}
      <div class="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3">
        <p class="typo-body-sm text-semantic-error">{form.error}</p>
      </div>
    {/if}

    <div class="flex gap-3">
      <select
        name="language"
        class="flex-1 rounded-md border border-hairline-strong bg-surface-card px-3 py-[10px] typo-body-sm text-ink transition-colors focus:border-ink focus:outline-none"
      >
        {#each Object.entries(data.languages) as [code, label]}
          <option value={code} selected={code === "eng"}>{label}</option>
        {/each}
      </select>

      <button
        type="submit"
        disabled={isSubmitting}
        class="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-[18px] typo-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-40"
      >
        {#if isSubmitting}
          <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing
        {:else}
          Extract Text
        {/if}
      </button>
    </div>
  </form>

  {#if isSubmitting}
    <div class="mt-section">
      <div class="typo-caption-uppercase mb-4 text-muted">Processing</div>
      <div class="flex flex-wrap gap-2">
        <TimelinePill stage="thinking" label="Queued" />
        <TimelinePill stage="reading" label="Reading" />
        <TimelinePill stage="editing" label="Processing" />
        <TimelinePill stage="done" label="Done" />
      </div>
    </div>
  {/if}

  {#if form?.result}
    <div class="mt-section space-y-6">
      <div class="typo-title-md text-ink">Extracted Text</div>

      <div class="rounded-lg border border-hairline bg-surface-card p-5">
        <pre
          class="typo-code overflow-x-auto whitespace-pre-wrap text-ink"
        >{form.result.text}</pre>
      </div>

      <div class="flex flex-wrap items-center gap-5 typo-body-sm text-muted">
        <span>
          Confidence
          <strong class="ml-1 text-ink">{form.result.confidence}%</strong>
        </span>
        <span class="text-hairline">|</span>
        <span>
          Time
          <strong class="ml-1 text-ink">{(form.result.processingTimeMs / 1000).toFixed(1)}s</strong>
        </span>
        <span class="text-hairline">|</span>
        <span>
          Language
          <strong class="ml-1 text-ink">{form.result.language}</strong>
        </span>
      </div>

      <button
        onclick={() => copyToClipboard(form.result.text)}
        class="inline-flex h-10 items-center gap-2 rounded-md border border-hairline-strong bg-surface-card px-[18px] typo-button text-ink transition-colors hover:bg-canvas-soft"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
