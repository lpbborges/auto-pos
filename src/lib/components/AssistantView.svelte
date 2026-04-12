<script lang="ts">
  import { tick } from 'svelte'
  import { Send, Bot } from 'lucide-svelte'
  import { cn } from '$lib/utils'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain Map intentional: avoids Svelte reactivity overhead on every cache write during streaming
  const renderCache = new Map<string, string>()
  function renderMarkdown(content: string): string {
    if (renderCache.has(content)) return renderCache.get(content)!
    const html = DOMPurify.sanitize(marked.parse(content) as string)
    renderCache.set(content, html)
    return html
  }

  type Message = { role: 'user' | 'assistant'; content: string }

  let messages = $state<Message[]>([])
  let input = $state('')
  let isLoading = $state(false)
  let error = $state<string | null>(null)
  let messagesEnd = $state<HTMLDivElement | null>(null)
  let inputEl = $state<HTMLTextAreaElement | null>(null)

  function scrollToBottom() {
    messagesEnd?.scrollIntoView({ behavior: 'smooth' })
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    // Snapshot history before mutating messages
    const priorHistory = [...messages]

    input = ''
    error = null
    messages = [...messages, { role: 'user', content: text }]

    // Add empty assistant message to fill in via streaming
    messages = [...messages, { role: 'assistant', content: '' }]
    isLoading = true

    try {
      const response = await fetch('/api/internal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: priorHistory,
        }),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const last = messages[messages.length - 1]
        if (last) {
          last.content += chunk
        }
        scrollToBottom()
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong'
      // Remove the empty assistant message on error
      messages = messages.slice(0, -1)
    } finally {
      isLoading = false
      scrollToBottom()
      await tick()
      inputEl?.focus()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
</script>

<div class="flex h-screen flex-col pb-16">
  <!-- Header -->
  <div class="border-b border-border bg-card px-4 py-3">
    <div class="mx-auto flex max-w-lg items-center gap-2">
      <Bot class="h-5 w-5 text-primary" />
      <h1 class="font-semibold">Assistente</h1>
    </div>
  </div>

  <!-- Message list -->
  <div class="flex-1 overflow-y-auto px-4 py-4">
    <div class="mx-auto max-w-lg space-y-4">
      {#if messages.length === 0}
        <div class="py-12 text-center text-muted-foreground">
          <Bot class="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p class="text-sm">Como posso te ajudar?</p>
          <p class="mt-1 text-xs opacity-70">
            Pergunte sobre como usar o app ou sobre os dados da sua loja.
          </p>
        </div>
      {/if}

      {#each messages as msg, i (i)}
        <div
          class={cn(
            'flex',
            msg.role === 'user' ? 'justify-end' : 'justify-start',
          )}
        >
          <div
            class={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground',
            )}
          >
            {#if msg.role === 'assistant' && msg.content === '' && isLoading}
              <span class="text-muted-foreground">Pensando...</span>
            {:else if msg.role === 'assistant'}
              <div class="prose prose-sm max-w-none dark:prose-invert">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized with DOMPurify -->
                {@html renderMarkdown(msg.content)}
              </div>
            {:else}
              <p class="whitespace-pre-wrap">{msg.content}</p>
            {/if}
          </div>
        </div>
      {/each}

      {#if error}
        <div
          class="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          <button onclick={() => (error = null)} class="ml-2 underline">
            Fechar
          </button>
        </div>
      {/if}

      <div bind:this={messagesEnd}></div>
    </div>
  </div>

  <!-- Input area -->
  <div class="border-t border-border bg-card px-4 py-3 pb-20">
    <div class="mx-auto flex max-w-lg gap-2">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKeydown}
        placeholder="Pergunte algo..."
        rows={1}
        disabled={isLoading}
        class="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      ></textarea>
      <button
        onclick={sendMessage}
        disabled={isLoading || !input.trim()}
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        aria-label="Enviar"
      >
        <Send class="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
