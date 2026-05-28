<script lang="ts">
  let {
    isDragging,
    previewUrl,
    uploadedFileName,
    fileInput,
    handleDrop,
    handleFileChange,
  }: {
    isDragging: boolean;
    previewUrl: string | null;
    uploadedFileName: string | null;
    fileInput: HTMLInputElement;
    handleDrop: (e: DragEvent) => void;
    handleFileChange: (e: Event) => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput?.click();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="cursor-pointer rounded-lg border-2 border-dashed p-10 transition-all duration-200
    {isDragging
      ? 'border-primary bg-primary/5'
      : 'border-hairline-strong hover:border-muted/50'}"
  role="button"
  tabindex="0"
  onkeydown={handleKeydown}
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => { isDragging = false; }}
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
    <div class="flex flex-col items-center gap-3">
      <img
        src={previewUrl}
        alt="Upload preview"
        class="max-h-48 rounded object-contain"
      />
      {#if uploadedFileName}
        <p class="typo-caption text-muted">{uploadedFileName}</p>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-soft">
        <svg class="h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>
      <div class="text-center">
        <p class="typo-body-sm text-body">
          <span class="font-medium text-ink">Click to upload</span>
          or drag and drop
        </p>
        <p class="typo-caption mt-1 text-muted-soft">
          PNG, JPEG, GIF, BMP, WebP &mdash; max 10MB
        </p>
      </div>
    </div>
  {/if}
</div>
