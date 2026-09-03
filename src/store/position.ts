import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePositionStore = defineStore(
  'position',
  () => {
    const favoriteIds = ref<string[]>([])

    function isFavorite(positionId: string) {
      return favoriteIds.value.includes(positionId)
    }

    function toggleFavorite(positionId: string) {
      if (isFavorite(positionId)) {
        favoriteIds.value = favoriteIds.value.filter(id => id !== positionId)
        return false
      }
      favoriteIds.value = [...favoriteIds.value, positionId]
      return true
    }

    return {
      favoriteIds,
      isFavorite,
      toggleFavorite,
    }
  },
  {
    persist: true,
  },
)
