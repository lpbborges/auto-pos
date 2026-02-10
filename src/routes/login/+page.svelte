<script lang="ts">
  import { Button, Input } from "$lib/components/ui";
  import { Lock, Mail, Loader2 } from "lucide-svelte";
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
  let isLoading = $state(false);
</script>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
  <div class="w-full max-w-sm space-y-6">
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p class="text-muted-foreground text-sm">Enter your credentials to sign in</p>
    </div>

    <form 
      method="POST" 
      class="space-y-4"
      use:enhance={() => {
        isLoading = true;
        return async ({ update }) => {
          isLoading = false;
          await update();
        };
      }}
    >
      {#if form?.error}
        <div class="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
          {form.error}
        </div>
      {/if}

      <div class="space-y-2">
        <label for="email" class="text-sm font-medium">Email</label>
        <div class="relative">
          <Mail class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@company.com"
            class="pl-10"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div class="space-y-2">
        <label for="password" class="text-sm font-medium">Password</label>
        <div class="relative">
          <Lock class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            class="pl-10"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <Button type="submit" class="w-full" disabled={isLoading}>
        {#if isLoading}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        {:else}
          Sign In
        {/if}
      </Button>
    </form>
  </div>
</div>
