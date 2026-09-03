import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePositionStore = defineStore(
  'position',
  () => {
    const favoriteIds = ref<string[]>([])
    /** 首页跳转到职位页时携带的待选招聘类别（如 社招 / 校招），职位页消费后需清空避免重复过滤。 */
    const pendingCategory = ref('')

    function setPendingCategory(category: string) {
      pendingCategory.value = category
    }

    function consumePendingCategory() {
      const category = pendingCategory.value
      pendingCategory.value = ''
      return category
    }

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
      pendingCategory,
      setPendingCategory,
      consumePendingCategory,
      isFavorite,
      toggleFavorite,
    }
  },
  {
    persist: true,
  },
)
