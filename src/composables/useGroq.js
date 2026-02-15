import { ref } from 'vue'
import { useScriptsStore } from '@/stores/scripts'

export function useGroq() {
  const scriptsStore = useScriptsStore()
  const streamedContent = ref('')
  const isStreaming = ref(false)

  async function generateIntros(topic, notes) {
    return await scriptsStore.generateIntros(topic, notes)
  }

  async function generateScript(topic, selectedIntro) {
    return await scriptsStore.generateScript(topic, selectedIntro)
  }

  async function generateScriptStreaming(topic, selectedIntro) {
    isStreaming.value = true
    streamedContent.value = ''

    try {
      for await (const chunk of scriptsStore.streamScript(topic, selectedIntro)) {
        streamedContent.value += chunk
      }
    } finally {
      isStreaming.value = false
    }

    return streamedContent.value
  }

  async function getFeedback(content, sectionType) {
    return await scriptsStore.fetchEditingFeedback(content, sectionType)
  }

  async function getPrediction(content) {
    return await scriptsStore.fetchPrediction(content)
  }

  async function generateScriptVariations(topic, selectedIntro) {
    return await scriptsStore.generateScriptVariations(topic, selectedIntro)
  }

  async function selectScriptVariation(topic, selectedIntro, variationContent) {
    console.log('useGroq.selectScriptVariation called with:', { topic, selectedIntro, contentLength: variationContent?.length })
    const result = await scriptsStore.selectScriptVariation(topic, selectedIntro, variationContent)
    console.log('useGroq.selectScriptVariation result:', result)
    return result
  }

  return {
    streamedContent,
    isStreaming,
    generateIntros,
    generateScript,
    generateScriptStreaming,
    generateScriptVariations,
    selectScriptVariation,
    getFeedback,
    getPrediction
  }
}
