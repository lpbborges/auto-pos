<script lang="ts">
  import { CheckCircle2 } from "lucide-svelte";
  import { Dialog, DialogHeader, DialogTitle, Button } from "$lib/components/ui";
  import { formatCurrency } from "$lib/utils";

  interface Props {
    open: boolean;
    total: number;
    itemCount: number;
    onconfirm: () => void;
    onclose: () => void;
  }

  let { open = $bindable(false), total, itemCount, onconfirm, onclose }: Props = $props();

  function handleConfirm() {
    onconfirm();
    open = false;
  }

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-sm">
  <DialogHeader class="items-center text-center">
    <div class="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
      <CheckCircle2 class="h-8 w-8 text-success" />
    </div>
    <DialogTitle class="text-xl">Confirmar Venda</DialogTitle>
    <div class="space-y-1 text-sm text-muted-foreground">
      <p>{itemCount} {itemCount === 1 ? "item" : "itens"}</p>
      <p class="text-2xl font-bold text-foreground">{formatCurrency(total)}</p>
    </div>
  </DialogHeader>

  <div class="flex gap-3 pt-4">
    <Button variant="outline" onclick={handleClose} class="touch-target flex-1">
      Cancelar
    </Button>
    <Button
      onclick={handleConfirm}
      class="touch-target flex-1 bg-success hover:bg-success/90"
    >
      Completar Venda
    </Button>
  </div>
</Dialog>
