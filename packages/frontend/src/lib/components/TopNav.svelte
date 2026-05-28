<script lang="ts">
  let menuOpen = $state(false);
</script>

<nav class="hairline-bottom flex h-16 items-center justify-between bg-canvas px-6 sm:px-10">
  <a href="/" class="typo-title-sm flex items-center gap-2 text-ink no-underline">
    <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-on-primary">
      O
    </span>
    <span class="hidden sm:inline">OCR Lab</span>
  </a>

  <div class="hidden items-center gap-8 md:flex">
    <a href="/" class="typo-nav-link text-ink no-underline transition-opacity hover:opacity-70">
      Home
    </a>
    <a
      href="https://github.com/itsgitz/ocr-lab"
      class="typo-nav-link text-muted no-underline transition-opacity hover:text-ink"
      target="_blank"
    >
      GitHub
    </a>
  </div>

  <button
    class="flex h-10 items-center justify-center rounded-md px-3 text-ink transition-colors hover:bg-hairline-soft md:hidden"
    onclick={() => menuOpen = !menuOpen}
    aria-label="Toggle menu"
  >
    {#if menuOpen}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    {:else}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    {/if}
  </button>
</nav>

{#if menuOpen}
  <div class="hairline-bottom bg-canvas px-6 py-4 md:hidden">
    <div class="flex flex-col gap-3">
      <a href="/" class="typo-nav-link text-ink no-underline" onclick={() => menuOpen = false}>
        Home
      </a>
      <a
        href="https://github.com/itsgitz/ocr-lab"
        class="typo-nav-link text-muted no-underline"
        target="_blank"
        onclick={() => menuOpen = false}
      >
        GitHub
      </a>
    </div>
  </div>
{/if}
