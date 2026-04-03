<script lang="ts">
  import {
    BottomNav,
    InventoryView,
    SalesView,
    ProfileView,
    AssistantView,
  } from '$lib/components'
  import { products } from '$lib/stores'
  import type { PageData } from './$types'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  $effect(() => {
    if (data.products) {
      products.set(data.products)
    }
  })

  let activeTab = $state<'inventory' | 'sales' | 'profile' | 'assistant'>(
    'inventory',
  )
</script>

<svelte:head>
  <title>Auto POS</title>
  <meta name="description" content="Point of Sale System" />
</svelte:head>

<div class="min-h-screen bg-background">
  {#if activeTab === 'inventory'}
    <InventoryView />
  {:else if activeTab === 'sales'}
    <SalesView />
  {:else if activeTab === 'assistant'}
    <AssistantView />
  {:else}
    <ProfileView user={data.user} store={data.store} />
  {/if}

  <BottomNav {activeTab} ontabchange={(tab) => (activeTab = tab)} />
</div>
