<script lang="ts">
  import { Dialog, DialogHeader, DialogTitle, DialogDescription, Button } from "$lib/components/ui";

  interface Props {
    open: boolean;
    productName: string;
    onconfirm: () => void;
    onclose: () => void;
  }

  let { open = $bindable(false), productName, onconfirm, onclose }: Props = $props();

  function handleConfirm() {
    onconfirm();
    open = false;
  }

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-md">
  <DialogHeader>
    <DialogTitle>Excluir Produto</DialogTitle>
    <DialogDescription>
      Tem certeza que seja excluir <strong>{productName}</strong>? Essa ação não pode ser desfeita.
    </DialogDescription>
  </DialogHeader>

  <div class="flex flex-col gap-2 pt-4 sm:flex-row">
    <Button variant="outline" onclick={handleClose} class="touch-target flex-1">
      Cancelar
    </Button>
    <Button
      onclick={handleConfirm}
      class="touch-target flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
    >
      Deletar
    </Button>
  </div>
</Dialog>
