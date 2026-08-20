export const createLatestTask = () => {
  let generation = 0

  return {
    async run(work) {
      const current = ++generation
      try {
        const value = await work()
        return { accepted: current === generation, value }
      } catch (error) {
        if (current !== generation) return { accepted: false, error }
        throw error
      }
    },
    cancel() {
      generation += 1
    }
  }
}
