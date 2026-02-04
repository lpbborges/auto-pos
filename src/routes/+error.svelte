<script lang="ts">
  import { page } from "$app/stores";
</script>

<svelte:head>
  <title>Erro - Auto POS</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
  <h1 class="mb-4 text-6xl font-bold text-primary">{$page.status}</h1>
  <p class="mb-8 text-xl text-muted-foreground">
    {$page.error?.message || "Something went wrong"}
  </p>
  <a
    href="/"
    class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    Go Home
  </a>
</div>
