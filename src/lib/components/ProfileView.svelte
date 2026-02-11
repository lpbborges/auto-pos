<script lang="ts">
  import { Button } from "$lib/components/ui";
  import PageHeader from "./PageHeader.svelte";
  import { toggleMode, mode } from "mode-watcher";
  import { LogOut, Sun, Moon, User, Store } from "lucide-svelte";

  interface Props {
    user: { email: string; id: string } | null;
    store?: { name: string; id: string } | null;
  }

  let { user, store }: Props = $props();
</script>

<div class="flex min-h-screen flex-col pb-20">
  <PageHeader title="Perfil" />

  <div class="flex-1 px-4 py-6">
    <!-- User Info Card -->
    <div class="mb-6 rounded-xl border border-border bg-card p-6">
      <div class="flex flex-col items-center gap-4">
        <!-- Avatar -->
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User class="h-10 w-10" />
        </div>

        <!-- User Email -->
        <div class="text-center">
          <h2 class="text-lg font-semibold text-foreground">{user?.email ?? 'Usuário'}</h2>
          <p class="text-sm text-muted-foreground">Usuário</p>
        </div>
      </div>
    </div>

    <!-- Store Info Card -->
    {#if store}
      <div class="mb-6 rounded-xl border border-border bg-card p-6">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
            <Store class="h-6 w-6 text-secondary-foreground" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Loja</p>
            <h3 class="text-base font-medium text-foreground">{store.name}</h3>
          </div>
        </div>
      </div>
    {/if}

    <!-- Settings Card -->
    <div class="mb-6 rounded-xl border border-border bg-card p-4">
      <h3 class="mb-4 text-sm font-medium text-muted-foreground">Configurações</h3>

      <!-- Theme Toggle -->
      <button
        onclick={toggleMode}
        class="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
      >
        <div class="flex items-center gap-3">
          {#if $mode === "dark"}
            <Sun class="h-5 w-5 text-muted-foreground" />
            <span class="text-sm font-medium text-foreground">Modo Claro</span>
          {:else}
            <Moon class="h-5 w-5 text-muted-foreground" />
            <span class="text-sm font-medium text-foreground">Modo Escuro</span>
          {/if}
        </div>
        <span class="text-xs text-muted-foreground">
          {$mode === "dark" ? "Escuro" : "Claro"}
        </span>
      </button>
    </div>

    <!-- Spacer to push logout to bottom -->
    <div class="flex-1"></div>
  </div>

  <!-- Logout Button - Fixed at bottom -->
  <form method="POST" action="?/logout" class="sticky bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
    <Button
      type="submit"
      variant="destructive"
      class="w-full gap-2"
    >
      <LogOut class="h-4 w-4" />
      Sair da Conta
    </Button>
  </form>
</div>
