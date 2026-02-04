<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  type Variant = "default" | "secondary" | "destructive" | "outline";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    variant?: Variant;
    class?: string;
  }

  let { variant = "default", class: className, children, ...restProps }: Props = $props();

  const variantClasses: Record<Variant, string> = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "text-foreground",
  };
</script>

<div
  class={cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    variantClasses[variant],
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
