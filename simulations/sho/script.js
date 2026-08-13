// Simple Harmonic Oscillator demo - vertical spring + energy curves (5-cycle window)

function $(id){return document.getElementById(id)}

// Parameters and state
let mass = parseFloat($('mass').value)
let k = parseFloat($('k').value)
let amp = parseFloat($('amp').value)
let gamma = parseFloat($('gamma').value)
let dt_ms = parseFloat($('dt').value)

let t = 0
let x = amp        // displacement (m), positive downward
let v = 0
let running = false
let raf = null

// Canvas setup
const animC = $('animCanvas')
const actx = animC.getContext('2d')
const energyC = $('energyCanvas')
const ectx = energyC.getContext('2d')
const specC = $('specCanvas')
const sctx = specC.getContext('2d')

// Data buffers
let buffer = []            // raw x samples for FFT
const MAX_SAMPLES = 32768

let energyBuffer = []      // {t, KE, PE}
const MAX_ENERGY_SAMPLES = 2000

// Hook up controls (range + number sync)
function bindRange(rangeId, numId, onChange){
  const r = $(rangeId), n = $(numId)
  r.addEventListener('input', ()=>{ n.value = r.value; onChange(r.value) })
  n.addEventListener('change', ()=>{ r.value = n.value; onChange(n.value) })
}
bindRange('mass','massNum', v=> mass = parseFloat(v))
bindRange('k','kNum', v=> k = parseFloat(v))
bindRange('amp','ampNum', v=> { amp = parseFloat(v); if(!running){ x = amp; drawAnim() }})
bindRange('gamma','gammaNum', v=> gamma = parseFloat(v))
bindRange('dt','dtNum', v=> dt_ms = parseFloat(v))

$('start').addEventListener('click', ()=> { if(!running){ running=true; loop() }})
$('pause').addEventListener('click', ()=> { running=false; if(raf) cancelAnimationFrame(raf) })
$('reset').addEventListener('click', ()=> { running=false; if(raf) cancelAnimationFrame(raf); t=0; x=amp; v=0; buffer=[]; energyBuffer=[]; drawAnim(); clearSpec(); clearEnergy() })
$('computeSpectrum').addEventListener('click', ()=> computeAndDrawSpectrum())

// Physics integrator: velocity Verlet-like update (simple stable integrator)
function step(dt){
  const a = (-k*x - gamma*v)/mass
  v += a*dt
  x += v*dt
  t += dt
  // store sample for FFT
  buffer.push(x)
  if(buffer.length > MAX_SAMPLES) buffer.shift()
  // store energy sample
  const KE = 0.5 * mass * v * v
  const PE = 0.5 * k * x * x   // potential relative to equilibrium (no gravity offset)
  energyBuffer.push({t: t, KE: KE, PE: PE})
  if(energyBuffer.length > MAX_ENERGY_SAMPLES) energyBuffer.shift()
}

// Drawing helpers for vertical spring (unchanged)
function drawSpring(ctx, x0, y0, x1, y1, coils=12, amp=10){
  const dx = x1 - x0
  const dy = y1 - y0
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  const px = -uy
  const py = ux
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  const step = length / coils
  for(let i=1;i<=coils;i++){
    const t = i / coils
    const baseX = x0 + ux * (t * length)
    const baseY = y0 + uy * (t * length)
    const sign = (i % 2 === 0) ? 1 : -1
    const sx = baseX + px * (amp * sign)
    const sy = baseY + py * (amp * sign)
    ctx.lineTo(sx, sy)
  }
  ctx.stroke()
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof r === 'undefined') r = 5
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  if(fill) ctx.fill()
  if(stroke) ctx.stroke()
}

// Animation drawing: vertical spring and mass
function drawAnim(){
  const W = animC.width, H = animC.height
  actx.clearRect(0,0,W,H)

  const cx = W/2
  const ceilingY = 20
  const scale = Math.max(40, (H-120)/2) // pixels per meter
  const equilibriumY = H/2
  const massY = equilibriumY + x * scale

  // ceiling
  actx.fillStyle = '#9aa6b2'
  actx.fillRect(cx-60, ceilingY-6, 120, 6)

  // spring
  actx.strokeStyle = '#4fd1c5'
  actx.lineWidth = 3
  drawSpring(actx, cx, ceilingY, cx, massY-30, 18, 8)

  // mass
  const mw = 80, mh = 50
  const mx = cx - mw/2
  const my = massY - mh/2
  actx.fillStyle = '#4fd1c5'
  roundRect(actx, mx, my, mw, mh, 8, true, false)
  actx.fillStyle = 'rgba(0,0,0,0.12)'
  actx.fillRect(mx+6, my+mh-6, mw-12, 6)

  // labels
  $('timeLabel').textContent = t.toFixed(2)
  $('posLabel').textContent = x.toFixed(3)
}

// Energy panel: draw KE and PE vs time for last 5 cycles
function clearEnergy(){
  ectx.clearRect(0,0,energyC.width,energyC.height)
  ectx.fillStyle = '#071021'
  ectx.fillRect(0,0,energyC.width,energyC.height)
  ectx.fillStyle = '#9aa6b2'
  ectx.fillText('Energy curves will appear here while running (5 cycles window)', 10, 20)
}

// Helper: linear interpolation between two samples
function lerp(a, b, f) { return a + (b - a) * f }

// Resample energyBuffer onto N uniformly spaced times between tStart and tEnd
function resampleEnergyWindow(tStart, tEnd, N) {
  if (energyBuffer.length === 0) {
    return { times: [], KE: [], PE: [] }
  }
  // Build arrays of times, KE, PE for binary search / interpolation
  const times = energyBuffer.map(s => s.t)
  const KEarr = energyBuffer.map(s => s.KE)
  const PEarr = energyBuffer.map(s => s.PE)

  const outTimes = new Array(N)
  const outKE = new Array(N)
  const outPE = new Array(N)

  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1)
    const tt = tStart + frac * (tEnd - tStart)
    outTimes[i] = tt

    // find right index j such that times[j] >= tt
    let j = 0
    // simple binary search
    let lo = 0, hi = times.length - 1
    if (tt <= times[0]) {
      j = 0
      outKE[i] = KEarr[0]
      outPE[i] = PEarr[0]
      continue
    } else if (tt >= times[hi]) {
      outKE[i] = KEarr[hi]
      outPE[i] = PEarr[hi]
      continue
    } else {
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (times[mid] < tt) lo = mid + 1
        else hi = mid - 1
      }
      j = lo
    }
    const t0 = times[j - 1], t1 = times[j]
    const f = (tt - t0) / (t1 - t0)
    outKE[i] = lerp(KEarr[j - 1], KEarr[j], f)
    outPE[i] = lerp(PEarr[j - 1], PEarr[j], f)
  }

  return { times: outTimes, KE: outKE, PE: outPE }
}


  // collect samples in window
  const samples = energyBuffer.filter(s => s.t >= tStart && s.t <= tEnd)
  if(samples.length < 2){
    ectx.fillStyle = '#9aa6b2'
    ectx.fillText('Collecting samples...', left + 10, top + 20)
    // draw time axis even if empty
    drawTimeAxis(ectx, left, top, plotW, plotH, tStart, tEnd, T)
    return
  }

  // find max energy for scaling
  let maxE = 0
  for(const s of samples){
    maxE = Math.max(maxE, s.KE, s.PE)
  }
  if(maxE <= 0) maxE = 1e-6

  // draw PE (blue-ish) and KE (orange)
  // PE
  ectx.beginPath()
  for(let i=0;i<samples.length;i++){
    const s = samples[i]
    const xp = left + ((s.t - tStart) / (tEnd - tStart)) * plotW
    const yp = top + plotH - (s.PE / maxE) * plotH
    if(i===0) ectx.moveTo(xp, yp)
    else ectx.lineTo(xp, yp)
  }
  ectx.strokeStyle = '#6fb3ff'
  ectx.lineWidth = 2
  ectx.stroke()
  // KE
  ectx.beginPath()
  for(let i=0;i<samples.length;i++){
    const s = samples[i]
    const xp = left + ((s.t - tStart) / (tEnd - tStart)) * plotW
    const yp = top + plotH - (s.KE / maxE) * plotH
    if(i===0) ectx.moveTo(xp, yp)
    else ectx.lineTo(xp, yp)
  }
  ectx.strokeStyle = '#ffb86b'
  ectx.lineWidth = 2
  ectx.stroke()

  // legend
  ectx.fillStyle = '#6fb3ff'
  ectx.fillRect(W - 160, top + 6, 12, 8)
  ectx.fillStyle = '#9aa6b2'
  ectx.fillText('Potential (PE)', W - 140, top + 14)
  ectx.fillStyle = '#ffb86b'
  ectx.fillRect(W - 160, top + 26, 12, 8)
  ectx.fillStyle = '#9aa6b2'
  ectx.fillText('Kinetic (KE)', W - 140, top + 34)

  // draw time axis ticks and label current time at right
  drawTimeAxis(ectx, left, top, plotW, plotH, tStart, tEnd, T)

  // draw current time marker (vertical line at right edge)
  const xNow = left + plotW
  ectx.strokeStyle = 'rgba(255,255,255,0.12)'
  ectx.beginPath()
  ectx.moveTo(xNow, top)
  ectx.lineTo(xNow, top + plotH)
  ectx.stroke()

  // print current time on x-axis (right)
  ectx.fillStyle = '#9aa6b2'
  ectx.fillText('t = ' + tEnd.toFixed(3) + ' s', W - 120, H - 8)
}
// Helper: linear interpolation between two samples
function lerp(a, b, f) { return a + (b - a) * f }

// Resample energyBuffer onto N uniformly spaced times between tStart and tEnd
function resampleEnergyWindow(tStart, tEnd, N) {
  if (energyBuffer.length === 0) {
    return { times: [], KE: [], PE: [] }
  }
  // Build arrays of times, KE, PE for binary search / interpolation
  const times = energyBuffer.map(s => s.t)
  const KEarr = energyBuffer.map(s => s.KE)
  const PEarr = energyBuffer.map(s => s.PE)

  const outTimes = new Array(N)
  const outKE = new Array(N)
  const outPE = new Array(N)

  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1)
    const tt = tStart + frac * (tEnd - tStart)
    outTimes[i] = tt

    // find right index j such that times[j] >= tt
    let j = 0
    // simple binary search
    let lo = 0, hi = times.length - 1
    if (tt <= times[0]) {
      j = 0
      outKE[i] = KEarr[0]
      outPE[i] = PEarr[0]
      continue
    } else if (tt >= times[hi]) {
      outKE[i] = KEarr[hi]
      outPE[i] = PEarr[hi]
      continue
    } else {
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (times[mid] < tt) lo = mid + 1
        else hi = mid - 1
      }
      j = lo
    }
    const t0 = times[j - 1], t1 = times[j]
    const f = (tt - t0) / (t1 - t0)
    outKE[i] = lerp(KEarr[j - 1], KEarr[j], f)
    outPE[i] = lerp(PEarr[j - 1], PEarr[j], f)
  }

  return { times: outTimes, KE: outKE, PE: outPE }
}

// helper: draw time axis ticks for the energy panel
function drawTimeAxis(ctx, left, top, plotW, plotH, tStart, tEnd, T){
  ctx.fillStyle = '#9aa6b2'
  ctx.font = '12px sans-serif'
  const tickCount = 6
  for(let i=0;i<=tickCount;i++){
    const frac = i / tickCount
    const tx = left + frac * plotW
    const tv = tStart + frac * (tEnd - tStart)
    // tick
    ctx.strokeStyle = '#234'
    ctx.beginPath()
    ctx.moveTo(tx, top + plotH)
    ctx.lineTo(tx, top + plotH + 6)
    ctx.stroke()
    // label
    ctx.fillStyle = '#9aa6b2'
    ctx.fillText(tv.toFixed(3), tx - 18, top + plotH + 20)
  }
  // x-axis label
  ctx.fillStyle = '#9aa6b2'
  ctx.fillText('Time (s) — last ' + ( (tEnd - tStart).toFixed(3) ) + ' s (' + Math.round((tEnd - tStart)/T) + ' cycles shown)', left, top + plotH + 36)
}

// Spectrum code (unchanged)
function clearSpec(){
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText('Spectrum will appear here after computing', 10, 20)
}

function fft(re, im){
  const n = re.length
  if(n <= 1) return
  const levels = Math.log2(n)
  if(Math.floor(levels) !== levels) throw 'FFT size must be power of 2'
  for(let i=0;i<n;i++){
    let j = 0, bit = i
    for(let k=0;k<levels;k++){
      j = (j<<1) | (bit & 1)
      bit >>= 1
    }
    if(j > i){ [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for(let size=2; size<=n; size<<=1){
    const half = size/2
    const theta = -2*Math.PI/size
    const wpr = Math.cos(theta), wpi = Math.sin(theta)
    for(let i=0;i<n;i+=size){
      let wr = 1, wi = 0
      for(let j=0;j<half;j++){
        const k = i+j
        const l = k+half
        const tr = wr*re[l] - wi*im[l]
        const ti = wr*im[l] + wi*re[l]
        re[l] = re[k] - tr
        im[l] = im[k] - ti
        re[k] += tr
        im[k] += ti
        const tmp = wr
        wr = tmp*wpr - wi*wpi
        wi = tmp*wpi + wi*wpr
      }
    }
  }
}

function computeAndDrawSpectrum(){
  if(buffer.length < 64){ alert('Collect more samples by running the simulation for a bit'); return }
  let N = 1
  while(N*2 <= buffer.length) N*=2
  const re = new Array(N).fill(0)
  const im = new Array(N).fill(0)
  for(let i=0;i<N;i++){
    const w = 0.5*(1 - Math.cos(2*Math.PI*i/(N-1)))
    re[i] = buffer[buffer.length - N + i] * w
  }
  fft(re,im)
  const dt = dt_ms/1000
  const fs = 1/dt
  const half = N/2
  const mags = new Array(half)
  const freqs = new Array(half)
  for(let i=0;i<half;i++){
    mags[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]) / N
    freqs[i] = i * fs / N
  }
  sctx.clearRect(0,0,specC.width,specC.height)
  sctx.fillStyle = '#071021'
  sctx.fillRect(0,0,specC.width,specC.height)
  sctx.strokeStyle = '#234'
  sctx.lineWidth = 1
  sctx.beginPath()
  sctx.moveTo(40,10)
  sctx.lineTo(40,specC.height-30)
  sctx.lineTo(specC.width-10,specC.height-30)
  sctx.stroke()
  const maxMag = Math.max(...mags)
  sctx.beginPath()
  for(let i=1;i<half;i++){
    const xpix = 40 + (specC.width-60) * (i/(half-1))
    const ypix = specC.height-30 - (specC.height-50) * (Math.log10(mags[i]+1e-12) - Math.log10(1e-12)) / (Math.log10(maxMag+1e-12)-Math.log10(1e-12))
    if(i===1) sctx.moveTo(xpix, ypix)
    else sctx.lineTo(xpix, ypix)
  }
  sctx.strokeStyle = '#ff7b72'
  sctx.lineWidth = 1
  sctx.stroke()
  let peakIdx = mags.indexOf(Math.max(...mags))
  sctx.fillStyle = '#9aa6b2'
  sctx.fillText('Peak freq: ' + freqs[peakIdx].toFixed(3) + ' Hz', 50, 20)
}

// Main loop
// Replace previous loop() with this fixed-dt accumulator version
let lastFrameTime = null
const SIM_DT = 0.001 // internal simulation step in seconds (1 ms). You can tune this.

function loop(now) {
  if (!lastFrameTime) lastFrameTime = now
  const elapsedMs = now - lastFrameTime
  lastFrameTime = now

  // Convert elapsed to seconds and accumulate
  let remaining = elapsedMs / 1000

  // Use user-controlled dt_ms as the "output sampling" rate for buffer/FFT,
  // but keep physics stable with SIM_DT. We'll step physics multiple times if needed.
  const userDt = dt_ms / 1000

  // Step physics in fixed increments of SIM_DT
  while (remaining > 0) {
    const stepDt = Math.min(SIM_DT, remaining)
    step(stepDt)           // advance physics by stepDt
    remaining -= stepDt
  }

  // Draw animation and energy (use current state)
  drawAnim()
  drawEnergyPanel()

  if (running) raf = requestAnimationFrame(loop)
  else lastFrameTime = null
}

// initial draw
drawAnim()
clearSpec()
clearEnergy()
