<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "svelte-sonner";

  let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
<Toaster position="top-center" richColors />

{@render children()}
