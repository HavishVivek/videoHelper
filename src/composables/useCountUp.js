import { ref, watch, onUnmounted } from 'vue'

/**
 * Tween a number from its current value to a target whenever the target changes.
 *
 * Respects prefers-reduced-motion: if the user prefers reduced motion the
 * displayed value jumps straight to the target with no animation.
 *
 * @param {() => number} getTarget  reactive getter returning the target number
 * @param {object}       [opts]
 * @param {number}       [opts.duration=900]  tween duration in ms
 * @param {number}       [opts.startDelay=0]  delay before the tween begins (ms)
 * @param {(n:number)=>number} [opts.round=Math.round]  how to round the live value
 * @returns {import('vue').Ref<number>}  the live, animating value
 */
export function useCountUp(getTarget, opts = {}) {
  const {
    duration = 900,
    startDelay = 0,
    round = Math.round,
  } = opts

  const display = ref(round(getTarget() || 0))

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let rafId = null
  let delayId = null

  function cancel() {
    if (rafId) cancelAnimationFrame(rafId)
    if (delayId) clearTimeout(delayId)
    rafId = null
    delayId = null
  }

  function animateTo(target) {
    cancel()
    if (reduceMotion || duration <= 0) {
      display.value = round(target)
      return
    }
    const from = display.value
    const delta = target - from
    if (delta === 0) {
      display.value = round(target)
      return
    }
    const run = () => {
      const start = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration)
        // ease-out-quart — matches the cubic-bezier(.22,.61,.36,1) used in CSS
        const eased = 1 - Math.pow(1 - t, 4)
        display.value = round(from + delta * eased)
        if (t < 1) {
          rafId = requestAnimationFrame(step)
        } else {
          display.value = round(target)
          rafId = null
        }
      }
      rafId = requestAnimationFrame(step)
    }
    if (startDelay > 0) {
      delayId = setTimeout(run, startDelay)
    } else {
      run()
    }
  }

  watch(getTarget, (val) => animateTo(val ?? 0), { immediate: true })

  onUnmounted(cancel)

  return display
}