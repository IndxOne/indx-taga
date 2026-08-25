export function simulate(result, options = {}) {
  const {
    delay = [400, 900],
    failRate = 0.35,
    errorMessage = 'Une erreur est survenue.',
    errorKinds = ['network'],
  } = options

  const [min, max] = delay
  const duration = min + Math.random() * (max - min)

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        const kind = errorKinds[Math.floor(Math.random() * errorKinds.length)]
        const message = typeof errorMessage === 'object' ? errorMessage[kind] : errorMessage
        const error = new Error(message)
        error.kind = kind
        reject(error)
        return
      }
      resolve(typeof result === 'function' ? result() : result)
    }, duration)
  })
}
