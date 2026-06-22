import { defineStore } from "pinia";
import { ref, watch } from "vue";

const STORAGE_KEY = "eden_settings";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const saved = load();

  // Search overlay blur, in px (0 = no blur, clearest; 20 = heavy frost)
  const searchBlur = ref(saved.searchBlur ?? 9);

  // Optional: backdrop dim opacity (0–0.7) paired with blur
  const searchDim = ref(saved.searchDim ?? 0.35);

  watch([searchBlur, searchDim], () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        searchBlur: searchBlur.value,
        searchDim: searchDim.value,
      }),
    );
  });

  return { searchBlur, searchDim };
});
