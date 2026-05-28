<script>
  import "../app.css";
  import TopNav from "$lib/components/TopNav.svelte";

  let { children } = $props();
</script>

<TopNav />

<main>
  {@render children()}
</main>

<footer class="hairline-bottom mt-section px-6 py-16 sm:px-10">
  <div class="mx-auto max-w-[1200px]">
    <div class="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
      <div class="flex items-center gap-2">
        <span class="flex h-6 w-6 items-center justify-center rounded bg-primary text-[11px] font-semibold text-on-primary">
          O
        </span>
        <span class="typo-body-sm text-muted">OCR Lab</span>
      </div>
      <p class="typo-body-sm text-muted-soft">
        Extract text from images &mdash; powered by Tesseract
      </p>
    </div>
  </div>
</footer>
